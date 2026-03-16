import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MealsService } from '../meals/meals.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email: string;
  email_verified: string;
  auth_time: number;
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mealsService: MealsService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });
    await this.mealsService.seedDefaultMeals(user.id);
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { sub: googleId, email, name } = payload;

    if (!email) {
      throw new UnauthorizedException('Google account does not have an email');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      } else {
        user = await this.prisma.user.create({
          data: { email, name: name || 'Google User', googleId },
        });
        await this.mealsService.seedDefaultMeals(user.id);
      }
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async appleLogin(dto: AppleLoginDto) {
    const applePayload = await this.verifyAppleToken(dto.identityToken);

    const { sub: appleId, email } = applePayload;

    if (!email) {
      throw new UnauthorizedException('Apple account does not have an email');
    }

    let user = await this.prisma.user.findUnique({ where: { appleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { appleId },
        });
      } else {
        user = await this.prisma.user.create({
          data: { email, name: dto.fullName || 'Apple User', appleId },
        });
        await this.mealsService.seedDefaultMeals(user.id);
      }
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  private async verifyAppleToken(identityToken: string): Promise<AppleTokenPayload> {
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid Apple token format');
    }

    let header: { kid?: string };
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    } catch {
      throw new UnauthorizedException('Invalid Apple token: unable to decode header');
    }

    const kid = header.kid;
    if (!kid) {
      throw new UnauthorizedException('Invalid Apple token: missing key ID');
    }

    let keys: { kid: string; n: string; e: string }[];
    try {
      const response = await fetch('https://appleid.apple.com/auth/keys');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      keys = data.keys;
    } catch {
      throw new UnauthorizedException('Invalid Apple token: failed to fetch Apple public keys');
    }

    const key = keys.find((k) => k.kid === kid);
    if (!key) {
      throw new UnauthorizedException('Invalid Apple token: key not found');
    }

    const publicKey = this.jwkToPem(key);

    let payload: AppleTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as AppleTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid Apple token: unable to decode payload');
    }

    const signatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url'),
    );

    if (!signatureValid) {
      throw new UnauthorizedException('Invalid Apple token: signature verification failed');
    }

    const now = Math.floor(Date.now() / 1000);
    const appleClientId = this.configService.get<string>('APPLE_CLIENT_ID');

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token: invalid issuer');
    }
    if (payload.aud !== appleClientId) {
      throw new UnauthorizedException('Invalid Apple token: invalid audience');
    }
    if (payload.exp < now) {
      throw new UnauthorizedException('Invalid Apple token: token expired');
    }

    return payload;
  }

  private jwkToPem(jwk: { n: string; e: string }): string {
    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');

    const nLen = n.length;
    const eLen = e.length;

    const rsaPublicKey = Buffer.concat([
      Buffer.from([0x30]),
      this.encodeLength(nLen + eLen + 4 + (n[0] & 0x80 ? 1 : 0) + (e[0] & 0x80 ? 1 : 0)),
      Buffer.from([0x02]),
      this.encodeLength(nLen + (n[0] & 0x80 ? 1 : 0)),
      n[0] & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0),
      n,
      Buffer.from([0x02]),
      this.encodeLength(eLen + (e[0] & 0x80 ? 1 : 0)),
      e[0] & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0),
      e,
    ]);

    const algorithmIdentifier = Buffer.from([
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
      0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    ]);

    const bitString = Buffer.concat([
      Buffer.from([0x03]),
      this.encodeLength(rsaPublicKey.length + 1),
      Buffer.from([0x00]),
      rsaPublicKey,
    ]);

    const spki = Buffer.concat([
      Buffer.from([0x30]),
      this.encodeLength(algorithmIdentifier.length + bitString.length),
      algorithmIdentifier,
      bitString,
    ]);

    const base64 = spki.toString('base64');
    const lines = base64.match(/.{1,64}/g) || [];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  private encodeLength(length: number): Buffer {
    if (length < 128) {
      return Buffer.from([length]);
    }
    const bytes: number[] = [];
    let temp = length;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }
}
