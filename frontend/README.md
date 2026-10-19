# Foody Delivery — Frontend

Aplicação web para a gestão da operação de delivery, construída com React, TypeScript e Vite. Esta etapa prepara a estrutura visual e técnica; autenticação, pedidos e geocodificação ainda serão integrados.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm
- Backend disponível em `http://localhost:8080` para futuras integrações com a API

## Instalação e execução local

Na primeira execução:

```bash
npm install
cp .env.example .env
npm run dev
```

O Vite inicia o frontend em `http://localhost:5173`. O servidor de desenvolvimento e as páginas placeholder funcionam sem iniciar a API.

## Variáveis de ambiente

| Variável            | Descrição                           | Padrão local            |
| ------------------- | ----------------------------------- | ----------------------- |
| `VITE_API_BASE_URL` | URL base pública da API Spring Boot | `http://localhost:8080` |

As variáveis prefixadas com `VITE_` são incorporadas ao bundle e devem conter apenas valores públicos. Não coloque segredos no frontend. O exemplo de ambiente da raiz permanece dedicado ao Docker Compose.

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
│   ├── layout/             # Sidebar, header e shell responsivo
│   └── ui/                 # Componentes compartilhados
├── features/               # Domínios de autenticação, pedidos e geocodificação
├── hooks/                  # Hooks compartilhados
├── lib/api/                # Cliente HTTP e utilitários de API
├── pages/                  # Páginas ligadas às rotas
├── test/                   # Configuração de testes
└── types/                  # Tipos compartilhados
```

## Rotas iniciais

- `/login`
- `/register`
- `/dashboard`
- `/orders`
- `/orders/:id`

Endereços desconhecidos exibem a página de fallback. As rotas atuais são placeholders e não fazem autenticação nem chamadas de negócio.
