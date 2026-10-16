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

## Planejado

Pedidos, itens, endereços, histórico de status, atualizações por WebSocket, geocodificação e frontend React ainda não foram implementados.
