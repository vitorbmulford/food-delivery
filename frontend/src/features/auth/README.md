# Autenticação

O módulo `features/auth` integra login, cadastro, consulta do usuário e sessão com o backend Spring Boot.

## Contratos

- `POST /api/auth/register`: envia `name`, `email` e `password`; recebe `201` com `{ id, name, email }`. O cadastro não autentica automaticamente.
- `POST /api/auth/login`: envia `email` e `password`; recebe `{ accessToken, tokenType, expiresIn }` e configura um cookie persistente `HttpOnly`.
- `POST /api/auth/refresh`: usa o cookie de sessão para renovar o access token após recarga ou expiração.
- `POST /api/auth/logout`: revoga a sessão no backend e remove o cookie.
- `GET /api/users/me`: recebe `{ id, name, email }` e exige o header `Authorization: Bearer <accessToken>`.

O backend aplica limites de 120 caracteres ao nome, 320 ao e-mail e 8–72 à senha. A senha de cadastro deve conter letra maiúscula, minúscula, número e símbolo. Erros seguem `ProblemDetail` (`detail`, e `errors` para validação; registro duplicado é `409`).

## Sessão e expiração

O access token fica somente em memória e não é persistido em `localStorage` ou `sessionStorage`. A sessão duradoura usa um cookie `HttpOnly`, `SameSite=Strict`; o valor bruto é armazenado como hash no backend. Assim, recarregar a página não encerra a sessão e o JavaScript não consegue ler o segredo de renovação.

O access token expira após 3600 segundos por padrão (`JWT_EXPIRATION_SECONDS`), mas é renovado automaticamente usando a sessão persistente. O cookie recebe validade deslizante de 400 dias e é revogado pelo endpoint de logout. Em produção, configure `AUTH_COOKIE_SECURE=true` e use HTTPS.

## Configuração e validação

Configure `VITE_API_BASE_URL` com a origem da API (padrão `http://localhost:8080`). O backend permite credenciais de cookie somente para a origem configurada em `FRONTEND_ORIGIN` (padrão `http://localhost:5173`).

Execute `npm run test:run` para os testes de componentes e sessão. Eles usam mocks e não dependem de um backend externo. O fluxo real exige a API e seu banco disponíveis localmente.
