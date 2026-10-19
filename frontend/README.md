# Foody Delivery — Frontend

Aplicação web para a gestão da operação de delivery, construída com React, TypeScript e Vite. A autenticação integra-se ao backend Spring Boot; pedidos e geocodificação permanecem fora do escopo desta etapa.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm
- Backend disponível em `http://localhost:8080` para login, cadastro e consulta do perfil

## Instalação e execução local

Na primeira execução:

```bash
npm install
cp .env.example .env
npm run dev
```

O Vite inicia o frontend em `http://localhost:5173`. As telas públicas abrem sem a API; login, cadastro e validação do perfil precisam do backend.

## Variáveis de ambiente

| Variável            | Descrição                           | Padrão local            |
| ------------------- | ----------------------------------- | ----------------------- |
| `VITE_API_BASE_URL` | URL base pública da API Spring Boot | `http://localhost:8080` |

As variáveis prefixadas com `VITE_` são incorporadas ao bundle e devem conter apenas valores públicos. Não coloque segredos no frontend. O exemplo de ambiente da raiz permanece dedicado ao Docker Compose.

O backend precisa permitir a origem do frontend por `FRONTEND_ORIGIN` (localmente `http://localhost:5173`). Ele aceita os headers `Authorization` e `Content-Type`. `VITE_API_BASE_URL` configura somente a URL base pública do cliente HTTP.

## Autenticação

- Cadastro envia `name`, `email` e `password` para `POST /api/auth/register`. O backend retorna `201` com o perfil, sem JWT; após sucesso, a pessoa entra pela tela de login.
- Login envia `email` e `password` para `POST /api/auth/login`. O backend retorna `accessToken`, `tokenType` e `expiresIn`, e cria uma sessão persistente em cookie `HttpOnly`.
- Ao recarregar a página, o frontend usa o cookie para renovar o token sem pedir novo login. O token de acesso é renovado automaticamente quando expira; somente o logout revoga a sessão.
- As rotas `/dashboard`, `/orders` e `/orders/:id` exigem sessão. Após login, o usuário retorna à rota que tentou abrir. As rotas públicas levam usuários autenticados ao dashboard.
- O perfil é obtido de `GET /api/users/me`; nome e e-mail aparecem no menu de perfil da barra lateral recolhível.
- Logout, resposta `401` de uma chamada privada ou falha na consulta de `/me` remove a sessão e os dados em cache.

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
- `/orders/:id`

Endereços desconhecidos exibem a página de fallback. O dashboard permanece sem indicadores fictícios; pedidos ainda são telas fora do escopo desta branch.

## Testes

Execute `npm run test:run` para rodar os testes automatizados sem depender de um backend externo.
