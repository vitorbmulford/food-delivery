# Mini Rastreador de Pedidos — Foody Delivery

Backend de um desafio técnico para uma aplicação simplificada de gerenciamento e acompanhamento de pedidos de delivery.

## Stack

- Java 21 e Spring Boot 4.1.1
- Spring MVC, Security, OAuth2 Resource Server, Data JPA e WebSocket
- PostgreSQL 17, Flyway, Bean Validation e Springdoc OpenAPI
- JUnit 5, Spring Security Test, Testcontainers, JaCoCo e SpotBugs
- Docker Compose

## Estrutura

```text
food-delivery-completo/
├── backend/                 # Aplicação Spring Boot
├── frontend/                # Planejado; ainda não implementado
├── compose.yaml
├── .env.example
└── README.md
```

## Configuração local

Copie `.env.example` para `.env` na raiz para usar Docker Compose. Para executar pelo IntelliJ a partir do módulo `backend`, crie `backend/.env` com as variáveis de JWT necessárias; esse arquivo é carregado localmente e é ignorado pelo Git.

```bash
cp .env.example .env
openssl rand -base64 32
```

Defina o valor gerado como `JWT_SECRET`. A chave deve ser texto de 32+ caracteres ou Base64 que represente pelo menos 32 bytes. Nunca versione a chave real.

Para iniciar somente PostgreSQL:

```bash
docker compose up -d postgres
```

Para iniciar todos os serviços:

```bash
docker compose up --build
```

A API fica em `http://localhost:8080` e o Swagger em `/swagger-ui/index.html`. Para encerrar preservando os dados, execute `docker compose down`.

## Autenticação

- `POST /api/auth/register`: cria um usuário, normaliza o e-mail e armazena a senha com BCrypt.
- `POST /api/auth/login`: autentica e emite JWT HS256 com issuer, UUID no subject e expiração configurável.
- `GET /api/users/me`: requer `Authorization: Bearer <token>`.

Senhas devem conter ao menos oito caracteres, letras maiúsculas/minúsculas, um dígito e um símbolo. O e-mail é único no PostgreSQL.

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"João Silva","email":"joao@example.com","password":"SenhaSegura123!"}'

curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"joao@example.com","password":"SenhaSegura123!"}'
```

No Swagger, clique em **Authorize** e informe somente o valor de `accessToken` retornado no login para testar endpoints protegidos.

## Maven

No diretório `backend/`:

```bash
./mvnw clean verify
```

O comando executa testes, gera JaCoCo e roda SpotBugs. Testes de integração usam PostgreSQL em Testcontainers e exigem Docker.

## Pedidos

Todos os endpoints de pedidos exigem `Authorization: Bearer <token>`. Um pedido é sempre associado ao usuário presente no JWT; não é aceito `customerId` no payload. Por enquanto, cada usuário visualiza e altera apenas os próprios pedidos.

- `POST /api/orders`: cria um pedido e retorna `201 Created` com o header `Location`.
- `GET /api/orders?page=0&size=10&status=RECEBIDO`: lista somente os pedidos do usuário, do mais recente ao mais antigo. O tamanho máximo da página é 50.
- `GET /api/orders/{id}`: consulta um pedido próprio; pedidos de terceiros retornam `404`.
- `PATCH /api/orders/{id}/status`: atualiza o status de um pedido próprio.
- `GET /api/orders/{id}/history`: retorna a timeline de status de um pedido próprio, do evento mais antigo ao mais recente.

Exemplo de criação:

```json
{
  "items": [
    { "productName": "Hambúrguer Artesanal", "quantity": 2, "unitPrice": 32.90 },
    { "productName": "Refrigerante", "quantity": 1, "unitPrice": 8.50 }
  ],
  "deliveryAddress": {
    "street": "Rua das Flores", "number": "120", "complement": "Apto 42",
    "neighborhood": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000"
  }
}
```

Itens exigem nome, quantidade maior que zero e preço unitário maior que zero; o endereço exige rua, número, bairro, cidade, UF de duas letras e CEP. Os valores monetários são calculados exclusivamente no backend com `BigDecimal`, arredondamento `HALF_UP` e duas casas decimais. O status inicial é sempre `RECEBIDO`.

### Máquina de estados

| Status atual | Próximos status permitidos |
| --- | --- |
| `RECEBIDO` | `EM_PREPARO`, `CANCELADO` |
| `EM_PREPARO` | `SAIU_PARA_ENTREGA`, `CANCELADO` |
| `SAIU_PARA_ENTREGA` | `ENTREGUE` |
| `ENTREGUE` | nenhum |
| `CANCELADO` | nenhum |

Transições inválidas e conflitos de atualização concorrente retornam `409 Conflict`; status ausente ou inválido retornam `400 Bad Request`. Para demonstrar o fluxo do MVP, o próprio cliente pode avançar o status. Em produção, esse endpoint deve ser limitado a restaurante, operação ou logística autorizados.

O schema é criado pelas migrations Flyway `V2__create_orders.sql`, `V3__add_order_geocoding.sql` e `V4__create_order_status_history.sql`, incluindo itens, endereço incorporado, índices de consulta, versão para optimistic locking e campos de geocodificação. O Swagger documenta os endpoints em `/swagger-ui/index.html` e permite executá-los após informar o JWT em **Authorize**.

### Histórico de status

Cada pedido criado após a migration V4 ganha, na mesma transação, um evento inicial imutável: `previousStatus: null` e `newStatus: RECEBIDO`. Cada transição aprovada pela máquina de estados adiciona um evento com o estado anterior, o novo estado, instante UTC e o UUID do usuário autenticado. A consulta é somente leitura, ordenada por `changedAt` e, em caso de empate, por `id`.

```json
[
  { "previousStatus": null, "newStatus": "RECEBIDO", "changedAt": "2026-10-16T19:30:00Z", "changedBy": "<user-uuid>" },
  { "previousStatus": "RECEBIDO", "newStatus": "EM_PREPARO", "changedAt": "2026-10-16T19:40:00Z", "changedBy": "<user-uuid>" }
]
```

O pedido e seu evento são persistidos atomicamente; uma transição inválida, acesso negado, falha de persistência ou conflito de optimistic locking faz rollback de ambos. Atualizações de geocodificação não são mudanças de status e não criam eventos. A V4 deliberadamente não cria eventos para pedidos anteriores: sem eventos originais, uma linha de baseline poderia parecer uma transição histórica comprovada. Para testar a timeline, crie um pedido, avance um status e execute `GET /api/orders/{id}/history` com o mesmo Bearer token.

## Geocodificação

Ao criar um pedido, ele é persistido primeiro com `geocodingStatus: PENDING`. Após o commit no banco, uma tarefa assíncrona em memória consulta o [Nominatim / OpenStreetMap](https://operations.osmfoundation.org/policies/nominatim/) e atualiza o pedido. A criação do pedido nunca espera nem falha por causa do provedor externo.

- `PENDING`: aguardando ou executando uma consulta.
- `SUCCESS`: latitude e longitude foram encontradas e persistidas.
- `NOT_FOUND`: o provedor não encontrou resultado; `coordinates` fica `null`.
- `FAILED`: timeout, rede indisponível, HTTP 429/5xx ou resposta inválida; `coordinates` fica `null`.

`GET /api/orders` e `GET /api/orders/{id}` incluem `coordinates` e `geocodingStatus`. O proprietário pode solicitar nova tentativa com `POST /api/orders/{id}/geocode`, que retorna `202 Accepted`. Coordenadas válidas não são sobrescritas e um guard em memória impede tentativas simultâneas para o mesmo pedido.

```json
{
  "coordinates": { "latitude": -23.5614, "longitude": -46.6559 },
  "geocodingStatus": "SUCCESS"
}
```

Configure `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT`, `NOMINATIM_CONNECT_TIMEOUT` e `NOMINATIM_READ_TIMEOUT` no `.env`. O limite é deliberadamente de uma requisição por segundo, com `User-Agent` identificável. O serviço público não deve ser usado para geocodificação em massa; em produção use contato real no User-Agent e avalie provedor gerenciado ou auto-hospedado conforme o volume.

A fila e o guard de duplicidade são somente em memória: tentativas em espera ou em andamento não são retomadas após reinício. O endpoint de reprocessamento é a recuperação manual segura. Os testes automatizados usam um servidor HTTP local simulado e nunca dependem do Nominatim público.

## Atualizações em tempo real de pedidos

O backend publica uma notificação STOMP depois que uma alteração de status é **confirmada no PostgreSQL**. Ela serve para atualizar a interface rapidamente; o histórico persistido e a API REST continuam sendo a fonte de verdade.

- Endpoint WebSocket nativo: `ws://localhost:8080/ws`
- Origem permitida: o valor de `FRONTEND_ORIGIN` (por padrão, `http://localhost:5173`)
- Broker simples em memória: `/queue`
- Prefixo de aplicação reservado: `/app`
- Assinatura permitida para clientes: `/user/queue/orders`

O JWT não vai na URL nem no handshake. Ele deve ser enviado no cabeçalho `Authorization` do frame STOMP `CONNECT`. O `sub` do token é o UUID do usuário e é associado ao `Principal` da sessão; por isso uma mensagem enviada a `/user/queue/orders` só é encaminhada às sessões daquele proprietário.

```javascript
import { Client } from "@stomp/stompjs";

const client = new Client({
  brokerURL: "ws://localhost:8080/ws",
  connectHeaders: { Authorization: `Bearer ${token}` },
  reconnectDelay: 5000
});

client.onConnect = () => {
  client.subscribe("/user/queue/orders", frame => {
    const event = JSON.parse(frame.body);
    // atualize a timeline/pedido local
  });
};
client.activate();
```

O payload é deliberadamente pequeno e não contém JWT, dados de endereço ou dados pessoais:

```json
{
  "eventType": "ORDER_STATUS_CHANGED",
  "orderId": "<uuid-do-pedido>",
  "previousStatus": "RECEBIDO",
  "newStatus": "EM_PREPARO",
  "historyId": "<uuid-do-historico>",
  "changedAt": "2026-10-16T20:00:00Z"
}
```

O servidor rejeita `CONNECT` sem JWT válido, subscriptions diferentes de `/user/queue/orders` e todo frame `SEND` de clientes. Não há endpoint STOMP que altere pedidos: transições continuam exclusivamente em `PATCH /api/orders/{id}/status`.

O evento só é emitido após o commit da transação que atualiza o pedido e cria o histórico; rollbacks, transições inválidas e acessos não autorizados não geram eventos. Como o broker é em memória, a entrega não é persistente nem exatamente uma vez. Caso o cliente desconecte, a mudança permanece salva e, após a reconexão automática do cliente, ele deve refazer `GET /api/orders` e/ou `GET /api/orders/{id}/history`.

## Fora do escopo

Mapas, rastreamento GPS, rotas, cálculo de distância/frete, catálogo, estoque, pagamentos e frontend React continuam fora do escopo.
