# Mini Rastreador de Pedidos — Foody Delivery

Backend inicial de um desafio técnico para uma aplicação simplificada de gerenciamento e acompanhamento de pedidos de delivery. Esta etapa prepara a fundação; os fluxos de negócio ainda não foram implementados.

## Stack

- Java 21 e Spring Boot 4.1.1
- Maven Wrapper
- Spring MVC, Security, OAuth2 Resource Server, Data JPA e WebSocket
- PostgreSQL 17 e Flyway
- Bean Validation e Springdoc OpenAPI / Swagger UI
- JUnit 5, Spring Security Test e Testcontainers
- JaCoCo e SpotBugs
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

## Pré-requisitos

- Java 21 para rodar o Maven localmente
- Docker Engine e Docker Compose para banco em container e execução completa

## Configuração local

Copie `.env.example` para `.env`. Os valores são credenciais descartáveis para desenvolvimento local. Não use esses valores em ambientes compartilhados ou publicados.

Inicie apenas o PostgreSQL:

```bash
docker compose up -d postgres
```

O banco fica disponível em `localhost:5432`, com volume persistente `postgres_data`. O Flyway cria somente sua tabela de histórico; ainda não existem migrations de domínio.

Para iniciar o backend pelo IntelliJ, abra `backend/pom.xml` como projeto Maven e execute `com.foody.backend.BackendApplication`. Configure no IntelliJ as variáveis `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` e `SERVER_PORT` se quiser substituir os defaults. O arquivo `.env` é lido automaticamente pelo Docker Compose, mas o IntelliJ não o carrega automaticamente.

## Docker Compose

Na raiz do repositório, execute:

```bash
docker compose up --build
```

Isso inicia o PostgreSQL e o backend depois do healthcheck do banco. A API ficará em `http://localhost:8080`; a documentação OpenAPI fica em `/swagger-ui/index.html`. Os serviços de backend e PostgreSQL usam as portas configuradas por `BACKEND_PORT` e `POSTGRES_PORT` no `.env`.

Para encerrar os serviços, preservando os dados:

```bash
docker compose down
```

Para apagar também o volume local do banco:

```bash
docker compose down -v
```

## Maven

No diretório `backend/`:

```bash
./mvnw clean verify
./mvnw test
./mvnw spotbugs:check
```

`verify` compila, executa os testes, gera os relatórios JaCoCo em `target/site/jacoco/` e executa SpotBugs. Os testes de integração usam PostgreSQL em Testcontainers e precisam de Docker.

## Segurança e configuração

O filtro de segurança deixa acessível apenas a documentação OpenAPI e nega as demais requisições até a implementação da autenticação. OAuth2 Resource Server está disponível no classpath para a futura validação JWT, mas emissão de tokens, cadastro, login e configuração de chaves ainda não existem. Não há chave JWT nem credenciais de produção no repositório.

Configurações principais:

| Variável | Padrão local | Uso |
| --- | --- | --- |
| `POSTGRES_DB` | `foody_delivery` | Banco no Compose |
| `POSTGRES_USER` | `foody` | Usuário local do PostgreSQL |
| `POSTGRES_PASSWORD` | `foody_local` | Senha local descartável |
| `POSTGRES_PORT` | `5432` | Porta publicada do banco |
| `BACKEND_PORT` | `8080` | Porta publicada do backend |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/foody_delivery` | JDBC da aplicação local |
| `SPRING_DATASOURCE_USERNAME` | `foody` | Usuário usado pela aplicação |
| `SPRING_DATASOURCE_PASSWORD` | `foody_local` | Senha usada pela aplicação |
| `SERVER_PORT` | `8080` | Porta HTTP da aplicação |

## Planejado

- Cadastro e autenticação JWT
- Criação e consulta de pedidos, itens e endereços
- Validação de status e histórico das alterações
- Atualizações em tempo real por WebSocket
- Geocodificação externa de endereços
- Frontend React, TypeScript, Vite e Material UI

Essas funcionalidades ainda não estão implementadas. Esta base não inclui controllers de negócio, entidades, migrations de domínio, frontend, Redis, RabbitMQ, GCP ou Kubernetes.
