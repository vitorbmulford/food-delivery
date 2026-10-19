# Foody Delivery

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
├── frontend/                # Aplicação React + TypeScript + Vite
├── compose.yaml
├── .env.example
└── README.md
```

## Configuração do ambiente

O `.env.example` na raiz é a referência do ambiente integrado via Docker Compose. O Compose lê automaticamente o `.env` da raiz para interpolar `${VAR}` no `compose.yaml`; copie o exemplo e substitua `JWT_SECRET` por uma chave local gerada. Todas as opções de Nominatim, retry, circuit breaker e rate limiting declaradas no exemplo são encaminhadas ao container do backend.

```bash
cp .env.example .env
openssl rand -base64 32
```

A chave JWT deve ser texto de 32+ caracteres ou Base64 que represente pelo menos 32 bytes. Nunca versione a chave real. O `.env.example` contém apenas valores de desenvolvimento e marcadores de exemplo.
Em produção, sirva frontend e backend via HTTPS e configure `AUTH_COOKIE_SECURE=true` para proteger o cookie persistente da sessão.

Para executar o backend diretamente pelo IntelliJ ou Maven, inicie o PostgreSQL em Compose e mantenha o diretório de trabalho como `backend/`. O Spring Boot importa um `.env` relativo ao diretório de trabalho: nesse modo, crie `backend/.env` apenas com `JWT_SECRET` (e eventuais `SPRING_DATASOURCE_*` ou outras variáveis que queira sobrescrever). Esse arquivo local é ignorado pelo Git e não precisa duplicar o exemplo da raiz. Sem sobrescritas de banco, a aplicação usa `localhost:5432/foody_delivery`, usuário `foody` e senha `foody_local`, os mesmos padrões do Compose. Se alterar os valores `POSTGRES_*` ou `POSTGRES_PORT` na configuração da raiz, ajuste as propriedades `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` e `SPRING_DATASOURCE_PASSWORD` em `backend/.env` para a execução direta: as variáveis `POSTGRES_*` são consumidas pelo Compose e não são aliases Spring.

O `.env` da raiz não é importado pelo Spring quando o diretório de trabalho é `backend/`; essa separação evita depender do diretório de onde o IntelliJ/Maven é iniciado. Não é necessário criar `backend/.env.example`: as variáveis de aplicação e seus padrões estão documentados em `backend/src/main/resources/application.yml`, e os valores concretos locais ficam em arquivos ignorados.

Para iniciar somente PostgreSQL:

```bash
docker compose up -d postgres
```

Para iniciar PostgreSQL, backend e frontend em containers:

```bash
docker compose up --build -d
```

Não é necessário executar `npm install` ou `npm ci` na máquina para usar o Compose. O build multi-stage do frontend instala as dependências dentro da imagem Docker. `npm ci` é necessário apenas para executar o Vite localmente, fora dos containers.

Abra a aplicação em `http://localhost:3000`. O Nginx serve a SPA com fallback para as rotas do React Router e encaminha `/api` e `/ws` (WebSocket Upgrade/STOMP) ao backend. O Swagger fica disponível em `http://localhost:8080/swagger-ui/index.html`. As portas publicadas podem ser alteradas por `FRONTEND_PORT`, `BACKEND_PORT` e `POSTGRES_PORT` no `.env`. O backend só fica pronto após o PostgreSQL e o healthcheck do Actuator; o frontend aguarda o backend saudável. Para encerrar os containers sem remover os dados, execute `docker compose down` (não use `-v`).

O Compose requer `JWT_SECRET` local com pelo menos 32 bytes; gere um com `openssl rand -base64 32` e grave apenas no `.env` ignorado pelo Git. `FRONTEND_ORIGIN` aceita origens exatas separadas por vírgula; o exemplo permite a interface Docker em `localhost:3000` e o Vite em `localhost:5173`. Ao publicar, substitua pelas origens realmente usadas. Em produção HTTPS, configure `AUTH_COOKIE_SECURE=true`. O bundle usa caminhos relativos por padrão. `VITE_API_BASE_URL` só deve ser definido para uma URL pública intencional, nunca para um segredo.

## Frontend

O frontend React + TypeScript + Vite fica em `frontend/`. Para instalar dependências e iniciar o servidor de desenvolvimento, execute `npm ci` e `npm run dev` nesse diretório. O Vite encaminha `/api` e `/ws` ao backend local em `http://localhost:8080`; assim, cookies e STOMP permanecem same-origin no navegador. Os requisitos, variáveis de ambiente e demais scripts estão documentados em [frontend/README.md](frontend/README.md).

## Autenticação

- `POST /api/auth/register`: cria um usuário, normaliza o e-mail e armazena a senha com BCrypt.
- `POST /api/auth/login`: autentica, emite JWT HS256 com issuer, UUID no subject e expiração configurável, e cria uma sessão persistente em cookie `HttpOnly`.
- `POST /api/auth/refresh`: renova o JWT usando o cookie de sessão; `POST /api/auth/logout` revoga a sessão.
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

Foody Delivery é uma plataforma de gestão: o usuário autenticado é o **operador** que possui e administra os pedidos; o **cliente** é externo, não possui login e seus dados são um snapshot histórico do pedido. O endereço persistido é o endereço de entrega do cliente. O isolamento, Dashboard, Insights, histórico, geocodificação e eventos privados continuam baseados exclusivamente no operador do JWT.

Todos os endpoints de pedidos exigem `Authorization: Bearer <token>`. `POST /api/orders` recebe `customer.name`, `customer.phone` e `customer.email` opcional, além dos itens e endereço; não aceita qualquer identificador de proprietário. O telefone é armazenado somente com dígitos brasileiros (DDD + 8 ou 9 dígitos). Pedidos anteriores à mudança podem ter cliente ausente.

```json
{
  "customer": { "name": "Maria Silva", "phone": "11999999999", "email": "maria@email.com" },
  "items": [{ "productName": "Hambúrguer", "quantity": 2, "unitPrice": 24.9 }],
  "deliveryAddress": { "street": "Rua Exemplo", "number": "123", "neighborhood": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000" }
}
```

- `POST /api/orders`: cria um pedido e retorna `201 Created` com o header `Location`.
- `GET /api/orders?page=0&size=10&status=RECEBIDO&search=Maria`: lista somente os pedidos do operador, do mais recente ao mais antigo. `search` encontra nome/e-mail parcialmente, telefone sem máscara ou o UUID exato. O tamanho máximo da página é 50.
- `GET /api/orders/{id}`: consulta um pedido próprio; pedidos de terceiros retornam `404`.
- `PATCH /api/orders/{id}/status`: atualiza o status de um pedido próprio.
- `GET /api/orders/{id}/history`: retorna a timeline de status de um pedido próprio, do evento mais antigo ao mais recente.

Exemplo de criação:

```json
{
  "items": [
    { "productName": "Hambúrguer Artesanal", "quantity": 2, "unitPrice": 32.9 },
    { "productName": "Refrigerante", "quantity": 1, "unitPrice": 8.5 }
  ],
  "deliveryAddress": {
    "street": "Rua das Flores",
    "number": "120",
    "complement": "Apto 42",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "postalCode": "01001000"
  }
}
```

Itens exigem nome, quantidade maior que zero e preço unitário maior que zero; o endereço exige rua, número, bairro, cidade, UF de duas letras e CEP. Os valores monetários são calculados exclusivamente no backend com `BigDecimal`, arredondamento `HALF_UP` e duas casas decimais. O status inicial é sempre `RECEBIDO`.

### Máquina de estados

| Status atual        | Próximos status permitidos       |
| ------------------- | -------------------------------- |
| `RECEBIDO`          | `EM_PREPARO`, `CANCELADO`        |
| `EM_PREPARO`        | `SAIU_PARA_ENTREGA`, `CANCELADO` |
| `SAIU_PARA_ENTREGA` | `ENTREGUE`                       |
| `ENTREGUE`          | nenhum                           |
| `CANCELADO`         | nenhum                           |

Transições inválidas e conflitos de atualização concorrente retornam `409 Conflict`; status ausente ou inválido retornam `400 Bad Request`. Para demonstrar o fluxo do MVP, o próprio cliente pode avançar o status. Em produção, esse endpoint deve ser limitado a restaurante, operação ou logística autorizados.

O schema de pedidos é criado pelas migrations Flyway `V2__create_orders.sql`, `V3__add_order_geocoding.sql` e `V4__create_order_status_history.sql`, incluindo itens, endereço incorporado, índices de consulta, versão para optimistic locking e campos de geocodificação. A V5 cria as sessões persistentes de autenticação, a V6 registra a origem das coordenadas e a V7 armazena separadamente sugestões aproximadas. O Swagger documenta os endpoints em `/swagger-ui/index.html` e permite executá-los após informar o JWT em **Authorize**.

### Histórico de status

Cada pedido criado após a migration V4 ganha, na mesma transação, um evento inicial imutável: `previousStatus: null` e `newStatus: RECEBIDO`. Cada transição aprovada pela máquina de estados adiciona um evento com o estado anterior, o novo estado, instante UTC e o UUID do usuário autenticado. A consulta é somente leitura, ordenada por `changedAt` e, em caso de empate, por `id`.

```json
[
  {
    "previousStatus": null,
    "newStatus": "RECEBIDO",
    "changedAt": "2026-10-16T19:30:00Z",
    "changedBy": "<user-uuid>"
  },
  {
    "previousStatus": "RECEBIDO",
    "newStatus": "EM_PREPARO",
    "changedAt": "2026-10-16T19:40:00Z",
    "changedBy": "<user-uuid>"
  }
]
```

O pedido e seu evento são persistidos atomicamente; uma transição inválida, acesso negado, falha de persistência ou conflito de optimistic locking faz rollback de ambos. Atualizações de geocodificação não são mudanças de status e não criam eventos. A V4 deliberadamente não cria eventos para pedidos anteriores: sem eventos originais, uma linha de baseline poderia parecer uma transição histórica comprovada. Para testar a timeline, crie um pedido, avance um status e execute `GET /api/orders/{id}/history` com o mesmo Bearer token.

## Geocodificação

Ao criar um pedido, ele é persistido primeiro com `geocodingStatus: PENDING`. Após o commit no banco, uma tarefa assíncrona em memória consulta o [Nominatim / OpenStreetMap](https://operations.osmfoundation.org/policies/nominatim/) e atualiza o pedido. A criação do pedido nunca espera nem falha por causa do provedor externo.

- `PENDING`: aguardando ou executando uma consulta.
- `SUCCESS`: latitude e longitude foram encontradas e persistidas.
- `NOT_FOUND`: o endereço completo não foi localizado; `coordinates` fica `null`. O backend tenta, em sequência, rua + cidade + UF, bairro e CEP. Uma referência só é exposta em `suggestedCoordinates` quando país, cidade, UF e o dado do nível consultado são compatíveis. Ela serve apenas para centralizar a seleção manual e nunca é confirmada como destino automaticamente.
- `FAILED`: timeout, rede indisponível, HTTP 429/5xx ou resposta inválida; `coordinates` fica `null`.

`GET /api/orders` e `GET /api/orders/{id}` incluem `coordinates`, `coordinateSource`, `geocodingStatus`, `suggestedCoordinates` e `geocodingSuggestionLevel`. O proprietário pode solicitar nova tentativa com `POST /api/orders/{id}/geocode`, que retorna `202 Accepted`, ou confirmar a seleção manual com `PATCH /api/orders/{id}/location`. A confirmação preserva o endereço postal e impede que uma resposta assíncrona posterior sobrescreva o ponto manual. Um guard em memória impede tentativas simultâneas para o mesmo pedido.

```json
{
  "coordinates": { "latitude": -23.5614, "longitude": -46.6559 },
  "geocodingStatus": "SUCCESS",
  "coordinateSource": "AUTOMATIC",
  "suggestedCoordinates": null,
  "geocodingSuggestionLevel": null
}
```

Configure `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT`, `NOMINATIM_CONNECT_TIMEOUT` e `NOMINATIM_READ_TIMEOUT` no `.env`. O limite é deliberadamente de uma requisição por segundo, com `User-Agent` identificável por URL pública do projeto ou contato monitorado; endereços fictícios como `admin@example.com` podem ser bloqueados com HTTP 403. O serviço público não deve ser usado para geocodificação em massa; em produção use contato real no User-Agent e avalie provedor gerenciado ou auto-hospedado conforme o volume. Falhas do provedor registram no backend o status HTTP, se são transitórias e o `Retry-After`, mantendo detalhes internos fora da resposta ao frontend.

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
  reconnectDelay: 5000,
});

client.onConnect = () => {
  client.subscribe("/user/queue/orders", (frame) => {
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

Rastreamento GPS em tempo real, rotas, cálculo de distância/frete, catálogo, estoque e pagamentos continuam fora do escopo. O frontend React e o mapa do endereço de entrega fazem parte do projeto.

## Resiliência e observabilidade

### Rate limiting

O backend aplica Bucket4j local (em memória) antes dos handlers: `POST /api/auth/login` aceita 10 requisições por minuto por IP da conexão, `POST /api/auth/register` aceita 5 por IP e `POST /api/orders/{id}/geocode` aceita 3 por minuto por usuário autenticado. O excedente recebe `429` com `Retry-After`. Os valores `RATE_LIMIT_*` são configuráveis. Buckets ociosos expiram após 15 minutos e o cache tem limite máximo; IPs e UUIDs nunca são escritos em logs ou tags de métricas. Não é usado `X-Forwarded-For`: se a aplicação estiver atrás de proxy confiável, configure o container/proxy para substituir corretamente o endereço remoto antes de encaminhar a requisição.

O limite é por instância: em múltiplas réplicas não há coordenação distribuída. Redis não foi introduzido nesta etapa.

### Nominatim: retry, circuit breaker e limite global

Cada chamada, inclusive retry, fallback e reprocessamento manual, passa pelo limitador global de uma requisição por segundo. A sequência progressiva faz no máximo quatro consultas quando todas retornam vazias e para no primeiro nível confiável. Cada nível tem Retry programático independente, portanto uma falha transitória tardia não repete as consultas anteriores. A política padrão é até 3 tentativas, backoff exponencial de 1 s, multiplicador 2, jitter de 20% e teto de 5 s. Timeout/rede, 429, 502, 503 e 504 podem ser repetidos; 400/401/403, endereço não encontrado e respostas válidas vazias não são. `Retry-After` numérico ou HTTP-date recebido em 429 adia o limitador global (até um orçamento seguro de um minuto), portanto uma tentativa posterior não antecipa o provedor.

O breaker `nominatim` inicia fechado, abre após a janela configurável (padrão: ao menos 5 chamadas, 50% de falhas), espera 30 s e permite 2 chamadas em `HALF_OPEN`. Quando aberto não há HTTP; a geocodificação é marcada como falha sem afetar o pedido já confirmado. Os parâmetros `NOMINATIM_RETRY_*` e `NOMINATIM_CIRCUIT_*` configuram a política. Como o executor assíncrono é propositalmente unitário, o backoff bloqueia essa única tarefa durante a espera: é uma limitação MVP documentada, sem fila distribuída.

Ordem operacional: rate limit de entrada → validação JWT → transação de pedido → evento após commit → executor assíncrono → circuit breaker da operação → sequência progressiva → retry do nível → limitador global Nominatim → cliente HTTP. O Circuit Breaker envolve a operação lógica inteira: um nível com retries esgotados conta como uma falha da operação, em vez de multiplicar a contagem por tentativa. Cada tentativa continua passando pelo limitador global; uma rejeição do breaker não é uma chamada HTTP.

### Actuator e métricas

São expostos somente `GET /actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness`, `/actuator/info` e `/actuator/metrics`; health é público e métricas exigem JWT. `env`, `beans` e `configprops` não são expostos. Métricas próprias incluem `orders.created`, `orders.status.changed`, `geocoding.requests`, `geocoding.failures`, `geocoding.duration` (operação completa, incluindo retries e esperas) e `rate.limit.rejected` (com tags de baixa cardinalidade). Não há tags com pedido, usuário, IP, endereço ou correlation ID.

### Logs e correlação

Todo request HTTP recebe `X-Correlation-ID`: valores aceitos têm 1–64 caracteres `[A-Za-z0-9._-]`, iniciando por alfanumérico; valores ausentes ou inválidos são substituídos por UUID seguro e retornados na resposta. O valor é posto no MDC e removido no `finally`. O executor de geocodificação usa `TaskDecorator` que captura, restaura e limpa MDC; a publicação STOMP após commit preserva o contexto da transação e frames STOMP também recebem contexto próprio. JWT, senhas, Authorization, cookies e endereço completo não são registrados.

Em desenvolvimento os logs continuam legíveis. Com o perfil `prod`, Spring Boot emite JSON Logstash nativo, por exemplo: `{"@timestamp":"...","log.level":"INFO","message":"Order status notification published operation=order.status.websocket orderId=... outcome=SUCCESS","correlationId":"..."}`. O ID é observabilidade interna e não é acrescentado ao payload público WebSocket.
