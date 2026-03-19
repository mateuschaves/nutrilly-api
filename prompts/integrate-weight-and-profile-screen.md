# Tarefa: Integração — Tela de Perfil e Log de Peso

## Contexto

O backend disponibilizou dois endpoints novos. Sua tarefa é integrá-los ao app substituindo qualquer dado mockado ou local que exista hoje nessas telas.

---

## Endpoint 1 — Tela de Perfil

### `GET /profile`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "name": "Mateus Henrique",
  "email": "mateus@nutrilly.app",
  "initials": "MH",
  "goal": "gain_muscle",

  "bodyStats": {
    "weight": { "value": 172.0, "unit": "lbs" },
    "height": { "cm": null, "feet": 5, "inches": 10, "unit": "ft_in" },
    "age": 29,
    "bmi": 24.6
  },

  "weightProgress": {
    "entries": [
      { "date": "2026-02-11", "value": 128.0, "unit": "lbs" },
      { "date": "2026-03-11", "value": 172.0, "unit": "lbs" }
    ],
    "totalEntries": 9,
    "min": { "value": 128.0, "unit": "lbs" },
    "max": { "value": 172.0, "unit": "lbs" },
    "change": { "value": 44.0, "unit": "lbs", "direction": "up" }
  },

  "dailyGoals": {
    "calories": { "consumed": 7699, "goal": 11339, "unit": "kJ" },
    "protein":  { "consumed": 87, "goal": 156 },
    "water":    { "consumed": 1.8, "goal": 2.6, "unit": "l" }
  }
}
```

### Mapeamento de campos para a UI

| Dado na tela | Campo da API |
|---|---|
| Nome e e-mail | `name`, `email` |
| Avatar com iniciais | `initials` |
| Badge de objetivo | `goal` — mapear para label: `lose_weight` → "Lose Weight", `maintain` → "Maintain", `gain_muscle` → "Gain Muscle" |
| Card Weight (Body Stats) | `bodyStats.weight.value` + `bodyStats.weight.unit` |
| Card Height (Body Stats) | se `unit === "ft_in"`: exibir `feet'inches"` (ex: `5'10"`); se `unit === "cm"`: exibir `bodyStats.height.cm + " cm"` |
| Card Age (Body Stats) | `bodyStats.age` |
| Card BMI (Body Stats) | `bodyStats.bmi` |
| Gráfico Weight Progress | `weightProgress.entries[]` — eixo X: `date`, eixo Y: `value` |
| "N entries logged" | `weightProgress.totalEntries` |
| "min X lbs" / "max X lbs" | `weightProgress.min.value` + unidade, `weightProgress.max.value` + unidade |
| "↑ X lbs overall" | `weightProgress.change.value` + unidade; seta para cima se `direction === "up"`, para baixo se `"down"`, sem seta se `"stable"` |
| Barra Calories | `dailyGoals.calories.consumed` / `dailyGoals.calories.goal` + `unit` |
| Barra Protein | `dailyGoals.protein.consumed` / `dailyGoals.protein.goal` (sempre em g) |
| Barra Water | `dailyGoals.water.consumed` / `dailyGoals.water.goal` + `unit` |

### Comportamento esperado

- Chamar o endpoint quando a tela de perfil for montada (e ao fazer pull-to-refresh).
- Exibir skeleton/loading enquanto a requisição está em andamento.
- Em caso de erro de rede, exibir mensagem de erro com opção de retry.
- `weightProgress.entries` pode ser um array vazio se o usuário ainda não tem nenhum log de peso — nesse caso ocultar ou mostrar estado vazio no gráfico.
- `bodyStats.weight`, `bodyStats.height`, `bodyStats.age` e `bodyStats.bmi` podem ser `null` se o usuário não preencheu o perfil — tratar cada campo individualmente com "—" ou equivalente.

---

## Endpoint 2 — Log de Peso

### `POST /weight`

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**
```json
{
  "weightKg": 78.5,
  "source": "APPLE_HEALTH",
  "loggedAt": "2026-03-19T08:00:00.000Z"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `weightKg` | `number` | sim | Peso **sempre em kg**, independente da unidade do usuário. Converter antes de enviar. |
| `source` | `enum` | sim | Origem do dado. Ver valores abaixo. |
| `loggedAt` | `string` ISO-8601 | não | Data/hora da medição. Omitir para usar o instante atual. Usar para backfill histórico. |

**Valores de `source`:**
| Valor | Quando usar |
|---|---|
| `APPLE_HEALTH` | Sync automático via HealthKit (iOS) |
| `SAMSUNG_HEALTH` | Sync automático via Samsung Health SDK |
| `GOOGLE_FIT` | Sync automático via Google Fit / Health Connect (Android) |
| `MANUAL` | Usuário digitou o peso diretamente no app |

**Response `201`:**
```json
{
  "id": "clx1y2z3a0000abc123def456",
  "weightKg": 78.5,
  "source": "APPLE_HEALTH",
  "loggedAt": "2026-03-19T08:00:00.000Z"
}
```

### Comportamento esperado — Sync com Health Provider

1. Criar uma **task em background** (ex: background fetch / WorkManager) que observa mudanças de peso no provider de saúde da plataforma (HealthKit no iOS, Health Connect no Android).
2. Ao detectar uma nova medição:
   - Converter o valor para kg se necessário.
   - Chamar `POST /weight` com o `source` correto e o `loggedAt` com o timestamp exato da medição no provider (não o momento do sync).
   - Em caso de erro, guardar em fila local e retentar com backoff exponencial.
3. No primeiro sync, enviar **todas as medições históricas** disponíveis no provider, respeitando a paginação/limite do provider. Usar o campo `loggedAt` de cada entrada histórica.
4. Evitar duplicatas: manter no storage local o timestamp da última medição sincronizada e enviar apenas entradas posteriores nos syncs subsequentes.

### Comportamento esperado — Input Manual

- Ao usuário tocar em "+ Log" na seção Weight Progress da tela de perfil:
  - Abrir modal/bottom sheet com campo de peso (respeitar a unidade de preferência do usuário exibida na tela).
  - Converter para kg antes de enviar (`source: "MANUAL"`, `loggedAt` omitido).
  - Após `201`, invalidar/refetch o `GET /profile` para atualizar o gráfico.

---

## Observações gerais

- **Unidades:** O backend já devolve todos os valores convertidos para a preferência do usuário. O app não deve fazer nenhuma conversão nos dados recebidos do `GET /profile`. A única conversão necessária é no `POST /weight`: sempre enviar `weightKg` em kg.
- **Autenticação:** Todos os endpoints exigem `Authorization: Bearer <token>`. Usar o token JWT armazenado na sessão do usuário.
- **Base URL:** Usar a constante de ambiente já configurada no projeto (`API_BASE_URL` ou equivalente).
- **Não alterar** outros endpoints ou telas além dos descritos neste documento.
