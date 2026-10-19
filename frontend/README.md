# Foody Delivery — Frontend

Aplicação web para a gestão da operação de delivery, construída com React, TypeScript e Vite. A autenticação e os pedidos integram-se ao backend Spring Boot, que também fornece as coordenadas geográficas dos endereços de entrega.

## Requisitos

- Node.js 20.19+, 22.12+ ou 24+
- npm
- Backend disponível em `http://localhost:8080` para login, cadastro, perfil e pedidos

## Instalação e execução local

Na primeira execução:

```bash
npm install
cp .env.example .env
npm run dev
```

O Vite inicia o frontend em `http://localhost:5173` e encaminha `/api` e `/ws` ao backend em `http://localhost:8080`, inclusive o Upgrade WebSocket. As telas públicas abrem sem a API; login, cadastro e validação do perfil precisam do backend.

## Variáveis de ambiente

| Variável            | Descrição                                                        | Padrão local |
| ------------------- | ---------------------------------------------------------------- | ------------ |
| `VITE_API_BASE_URL` | URL base pública da API Spring Boot; vazia usa proxy same-origin | vazio        |

As variáveis prefixadas com `VITE_` são incorporadas ao bundle e devem conter apenas valores públicos. Não coloque segredos no frontend. O exemplo de ambiente da raiz permanece dedicado ao Docker Compose.

No desenvolvimento local, o backend precisa permitir `FRONTEND_ORIGIN=http://localhost:5173`; em Docker, o padrão é `http://localhost:3000`. Configure a origem para o host e porta realmente usados no navegador. O backend aceita os headers `Authorization` e `Content-Type`. `VITE_API_BASE_URL` configura somente a URL base pública do cliente HTTP; não inclua segredos nessa variável.

## Execução com Docker Compose

Na raiz do repositório, configure `JWT_SECRET` no `.env` (copie `.env.example` e substitua o marcador) e execute `docker compose up --build -d`. A aplicação estará em `http://localhost:3000`; o Nginx encaminha `/api` e `/ws` ao Spring Boot e usa `index.html` como fallback das rotas SPA. Em produção com HTTPS, use `AUTH_COOKIE_SECURE=true`.

## Autenticação

- Cadastro envia `name`, `email` e `password` para `POST /api/auth/register`. O backend retorna `201` com o perfil, sem JWT; após sucesso, a pessoa entra pela tela de login.
- Login envia `email` e `password` para `POST /api/auth/login`. O backend retorna `accessToken`, `tokenType` e `expiresIn`, e cria uma sessão persistente em cookie `HttpOnly`.
- Ao recarregar a página, o frontend usa o cookie para renovar o token sem pedir novo login. O token de acesso é renovado automaticamente quando expira; somente o logout revoga a sessão.
- As rotas `/dashboard`, `/orders`, `/orders/new` e `/orders/:id` exigem sessão. Após login, o usuário retorna à rota que tentou abrir. As rotas públicas levam usuários autenticados ao dashboard.
- O perfil é obtido de `GET /api/users/me`; nome e e-mail aparecem no menu de perfil da barra lateral recolhível.
- Logout, resposta `401` de uma chamada privada ou falha na consulta de `/me` remove a sessão e os dados em cache.

## Atualizações em tempo real

- Com uma sessão autenticada, o frontend abre uma conexão STOMP em `/ws` (host derivado de `VITE_API_BASE_URL`) e envia `Authorization: Bearer <accessToken>` somente no frame STOMP `CONNECT`. O JWT continua apenas em memória; não é colocado na URL, `localStorage` ou `sessionStorage`.
- A única subscription é o destino privado `/user/queue/orders`. O backend envia `ORDER_STATUS_CHANGED` depois do commit, com `orderId`, `previousStatus`, `newStatus`, `historyId` e `changedAt`. O evento é validado e usado como sinal para invalidar as queries REST das listas, do detalhe e do histórico desse pedido; o cache permanece sob controle do TanStack Query.
- Reconexões usam backoff exponencial limitado a 30 segundos. Antes de cada tentativa de reconexão, o cliente usa `POST /api/auth/refresh` e o cookie HttpOnly existente para obter um access token novo. Falha definitiva aciona o evento de expiração já consumido pelo fluxo de logout. Eventos de rede `online` e `offline` interrompem ou retomam as tentativas.
- O indicador discreto no layout autenticado mostra conectado, reconectando ou desconectado. A aplicação continua usando REST quando STOMP está indisponível; filtros e paginação permanecem na URL e a query ativa é refeita com os mesmos parâmetros.
- O WebSocket do backend publica mudanças de status, não conclusão de geocodificação. Por isso, o polling atual do detalhe permanece limitado a cinco segundos por até dois minutos enquanto `geocodingStatus` está `PENDING` e a página está visível.

O access token fica em memória e dura 3600 segundos por padrão (`JWT_EXPIRATION_SECONDS`). A sessão persistente usa um cookie `HttpOnly`, `SameSite=Strict`, renovado por até 400 dias a cada uso e revogado no logout. Configure `AUTH_COOKIE_SECURE=true` em produção com HTTPS.

Tokens em memória não persistem entre recargas, mas continuam acessíveis a JavaScript enquanto a página está aberta. Isso não oferece a proteção de um cookie `HttpOnly`.

## Scripts

| Comando                | Descrição                                     |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Inicia o Vite em modo de desenvolvimento      |
| `npm run build`        | Verifica os tipos e gera o bundle de produção |
| `npm run preview`      | Serve localmente o bundle de produção         |
| `npm run lint`         | Executa o ESLint                              |
| `npm run test`         | Executa o Vitest em modo watch                |
| `npm run test:run`     | Executa os testes uma vez                     |
| `npm run format`       | Formata os arquivos do frontend com Prettier  |
| `npm run format:check` | Confere a formatação sem alterar arquivos     |

## Estrutura

```text
src/
├── app/                    # Providers, roteamento e tema
├── components/
│   ├── layout/             # Barra lateral recolhível e shell responsivo
│   └── ui/                 # Componentes compartilhados
├── features/               # Domínios de autenticação, pedidos e geocodificação
├── hooks/                  # Hooks compartilhados
├── lib/api/                # Cliente HTTP e utilitários de API
├── pages/                  # Páginas ligadas às rotas
├── test/                   # Configuração de testes
└── types/                  # Tipos compartilhados
```

## Rotas

- `/login`
- `/register`
- `/dashboard`
- `/orders`
- `/orders/new`
- `/orders/:id`

Endereços desconhecidos exibem a página de fallback. `/orders` lista pedidos reais com paginação e filtro por status sincronizados à URL. `/orders/new` cria pedidos por formulário validado e `/orders/:id` mostra o pedido consultado na API, itens, endereço, cliente, totais, andamento resumido e histórico real de mudanças. UUIDs inválidos são barrados antes da consulta; pedidos ausentes ou inacessíveis recebem o estado de não encontrado.

Os detalhes usam `GET /api/orders/{id}` e o histórico usa `GET /api/orders/{id}/history`. O histórico é exibido em ordem cronológica com status anterior/novo, horário e identificador do responsável quando disponível. A consulta do histórico falha de forma independente: se ela estiver indisponível, os detalhes continuam visíveis e há uma opção para tentar novamente. O indicador de progresso resume o fluxo possível (`RECEBIDO` → `EM_PREPARO` → `SAIU_PARA_ENTREGA` → `ENTREGUE`); pedidos cancelados são mostrados separadamente e eventos realmente ocorridos aparecem somente na timeline.

A seção **Localização da entrega** usa `coordinates`, `coordinateSource`, `geocodingStatus`, `suggestedCoordinates` e `geocodingSuggestionLevel` retornados em `GET /api/orders/{id}`. `PENDING` informa que o processamento assíncrono está em andamento; `SUCCESS` apresenta as coordenadas e identifica se a origem é automática ou manual; `NOT_FOUND` informa que o endereço exato não foi localizado, enquanto `FAILED` indica uma falha técnica. Os estados terminais permitem pedir nova tentativa. O botão chama `POST /api/orders/{id}/geocode`, que responde `202 Accepted`: isso confirma o enfileiramento, não a conclusão da geocodificação. Os detalhes são invalidados e consultados novamente; enquanto o estado estiver pendente, TanStack Query atualiza a cada cinco segundos por até dois minutos, apenas com a página visível. Depois do limite, a pessoa pode atualizar manualmente.

O mapa é carregado sob demanda com **React Leaflet** e **Leaflet**, usando tiles do OpenStreetMap e sua atribuição obrigatória. O acesso aos tiles depende de conexão com a internet e está sujeito à [política de uso do serviço público OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/); a aplicação não faz consultas ao Nominatim pelo navegador. Quando o endereço exato não é encontrado, uma referência validada de rua, bairro ou CEP centraliza o mapa de seleção manual e é apresentada explicitamente como aproximada. Ela só se torna o destino após confirmação do usuário por `PATCH /api/orders/{id}/location`; o endereço postal permanece intacto. Sem referência compatível, o mapa continua disponível a partir da visão geral do Brasil. O marcador confirmado identifica o ponto da entrega, nunca a posição em tempo real do entregador. Não há rotas, distância ou estimativa de entrega.

As ações chamam `PATCH /api/orders/{id}/status` com `{ "status": "..." }`. O frontend oferece as transições aceitas pelo backend: recebido para preparo ou cancelado; preparo para saiu para entrega ou cancelado; saiu para entrega para entregue. Entregue e cancelado são estados finais. Cancelamentos pedem confirmação. Uma resposta `409` causa recarga dos detalhes, do histórico e das listas, e os erros de rede/API mostram mensagens seguras com opção de nova tentativa quando aplicável. Os dados detalhados e o histórico usam chaves privadas do TanStack Query; logout e expiração continuam limpando o cache pelo fluxo de sessão existente.

## Testes

Execute `npm run test:run` para rodar os testes automatizados sem depender de um backend externo. Os testes de pedidos simulam respostas da API; a integração ponta a ponta exige backend, banco e credenciais disponíveis.
