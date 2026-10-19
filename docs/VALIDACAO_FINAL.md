# Validação final — Foody Delivery

**Data:** 19/10/2026  
**Branch:** `chore/integration-final`  
**Escopo:** integração Docker frontend/backend/PostgreSQL, fluxos de autenticação e pedidos, isolamento entre usuários, STOMP, testes automatizados e documentação.

## Resumo do ambiente

- Java 21.0.12.1, Maven Wrapper 3.10.0, Node.js 24.21.0, npm 11.19.0, Docker 29.9.1, Compose 5.6.0 e cliente `psql` 17.11 disponíveis.
- Antes da inicialização, já havia um PostgreSQL do projeto em `5432` e um backend Java local em `8080`. Para manter ambos ativos, a validação Compose publicou o backend em `18080` e o frontend em `3000`. O PostgreSQL e seu volume existentes foram reutilizados; nenhum `down`, remoção ou reset foi executado.
- O arquivo `.env` da raiz e `backend/.env` já existiam e permaneceram no lugar. Os valores secretos não foram exibidos nem substituídos. Foi ajustado somente o `FRONTEND_ORIGIN` não secreto da raiz para permitir as origens locais `localhost:3000` (Compose) e `localhost:5173` (Vite).
- Na subida do Compose, o banco já estava na versão Flyway 7. O backend validou as sete migrations e informou que o schema estava atualizado.

## Matriz de validação

| Funcionalidade | Cenário testado | Método de validação | Resultado | Evidência e limitações |
| --- | --- | --- | --- | --- |
| Ambiente e ferramentas | Versões Java, Maven, Node, npm, Docker, Compose e PostgreSQL; portas ocupadas | Inspeção de terminal (`java`, `./mvnw`, `node`, `npm`, `docker`, `psql`, `ss`) | **PASSOU** | Versões e conflitos estão resumidos acima. `8080` estava ocupado pelo backend local. |
| Configuração Compose | Parse e interpolação dos serviços, portas e dependências | `docker compose config --quiet` e inspeção da configuração resolvida | **PASSOU** | Serviços `postgres`, `backend` e `frontend`; dependências condicionadas à saúde. |
| Build e inicialização Docker | Build multi-stage, subida completa e healthchecks | `docker compose up --build -d` com `BACKEND_PORT=18080` devido ao conflito local | **PASSOU** | PostgreSQL e backend ficaram saudáveis; frontend serviu em `http://localhost:3000`. O comando sem override conflitaria com o processo local em `8080` neste ambiente. |
| SPA e Nginx | Página inicial, fallback de rota React e endpoint de saúde | HTTP real para `/`, `/orders/not-a-real-route` e `/health` | **PASSOU** | A rota desconhecida da SPA retornou `200 text/html`; health respondeu `ok`. |
| Proxy HTTP | API pelo endereço do frontend, inclusive rota protegida sem token | HTTP real para `/api/users/me` | **PASSOU** | O proxy encaminhou ao backend e retornou `401`, sem falhar por conexão ou CORS. |
| Autenticação | Cadastro, login válido/inválido, rota protegida, refresh, logout e refresh após logout | Cenário HTTP com dois usuários no endereço publicado do frontend; testes de integração backend | **PASSOU** | Cadastro/login e perfil protegidos funcionaram; credencial inválida retornou `401`; cookie foi `HttpOnly`, `SameSite=Strict`; refresh após logout retornou `401`. O bearer JWT emitido antes do logout continuou válido até sua expiração (`200` no perfil), conforme o desenho stateless atual. |
| Cookie e proxy same-origin | Cookie de sessão por `/api/auth` através do Nginx | Inspeção do `Set-Cookie` no teste HTTP | **PASSOU** | `HttpOnly` e `SameSite=Strict` confirmados. `Secure=false` no ambiente local HTTP; em HTTPS deve ser configurado como `true`. |
| Criação e leitura de pedido | Pedido com dois itens, soma do total, listagem, detalhes e histórico inicial | HTTP real pelo frontend; `OrdersIntegrationTests` | **PASSOU** | Total conferido em `26.00`, dois itens e evento inicial `RECEBIDO`. |
| Transições e histórico | `RECEBIDO` → `EM_PREPARO` → `SAIU_PARA_ENTREGA` → `ENTREGUE`; transição terminal inválida | HTTP real e testes de integração | **PASSOU** | Histórico final com quatro eventos; tentativa após `ENTREGUE` retornou `409`. Testes cobrem também cancelamento permitido e transições inválidas. |
| Isolamento de pedidos | Acesso cruzado a detalhe, histórico, mudança de status e geocodificação | HTTP real com dois usuários autenticados; `OrdersIntegrationTests` | **PASSOU** | As quatro operações do usuário A sobre pedido de B retornaram `404`, preservando a política de não revelar recurso alheio. |
| Paginação, filtro e validação de pedido | Consulta paginada, parâmetros de status, dados inválidos, pedido inexistente e conflitos | Testes frontend da serialização de página/status; `OrdersIntegrationTests`; fluxo HTTP real | **PASSOU** | Backend foi consultado com página limitada; testes automatizados cobrem payloads inválidos, `404` e `409`. Não foi exercitada uma sequência de múltiplas páginas nem um filtro de status contra a API Compose nesta execução. |
| Dashboard e isolamento | Período customizado, contagens por status, eventos de entrega/cancelamento, listas e timezone | `OrdersIntegrationTests`; HTTP real por dois usuários; Dashboard no navegador | **PASSOU** | Testes validam datas em `America/Sao_Paulo`, agregados e escopo do proprietário. HTTP confirmou que o painel de A não listou pedido de B. Navegador exibiu o período de sete dias. Nem todo filtro visual foi selecionado manualmente. |
| WebSocket/STOMP pelo Nginx | Upgrade `/ws`, CONNECT JWT, subscription privada, evento após mudança de status e isolamento entre clientes | Dois clientes STOMP Node conectados ao frontend publicado; `OrderRealtimeWebSocketIntegrationTests` | **PASSOU** | A transição foi recebida pelo dono e não pelo segundo usuário. Testes backend cobrem evento após commit, rollback, correlação e concorrência. O ciclo de reconexão/logout foi coberto por testes unitários do frontend, não por interrupção de rede real no navegador. |
| Frontend no navegador | Sessão restaurada, Dashboard, lista, formulário de criação e indicador STOMP | Navegador integrado, inspeção da árvore de acessibilidade e screenshot | **PASSOU** | `/login` redirecionou para Dashboard porque o navegador já tinha sessão local válida; painel mostrou STOMP conectado. Lista e formulário carregaram. Não foi submetido outro formulário pelo navegador. Inspeção de console JavaScript não foi executada. |
| ViaCEP | CEP válido, inexistente, falha de rede, timeout e resposta antiga ignorada | Testes Vitest com mocks | **PASSOU** | Cobertura em `cepApi.test.ts` e `useCepLookup.test.ts`; não foram feitos testes manuais contra o serviço público. |
| Nominatim e mapa | Retry, rate limit, circuito, erro, estados e localização manual | Testes backend/frontend com mocks e inspeção estática; criação HTTP real iniciou pedidos | **PASSOU** | Suíte automatizada cobre retry e resiliência com provedores simulados. O resultado assíncrono de geocodificação externa e a renderização visual do mapa não foram aguardados/confirmados nesta execução. |
| Banco e Flyway | Migrations em schema vazio e banco Compose existente | Testcontainers durante `clean verify`; log de inicialização Compose | **PASSOU** | Os sete scripts foram aplicados em PostgreSQL isolado; o banco existente permaneceu em v7 sem mudanças de migration. |
| Segurança e arquivos locais | Segredos ignorados, variáveis no frontend, contextos Docker e origem permitida | Inspeção estática de `.gitignore`, arquivos de ambiente e Dockerfiles | **PASSOU** | `.env` local não é rastreado; `.dockerignore` de raiz, backend e frontend excluem ambientes e artefatos. `VITE_API_BASE_URL` é vazio por padrão. Defaults de banco são apenas valores locais de desenvolvimento. |
| Testes frontend | Lint, 68 testes, build Vite e formatação | `npm run lint`, `npm run test:run`, `npm run build`, `npm run format:check` | **PASSOU** | 14 arquivos de teste, 68 testes aprovados; build de produção concluído. |
| Testes backend | Compilação, testes unitários/integração, Testcontainers, JaCoCo e SpotBugs | `./mvnw clean verify` | **PASSOU** | 67 testes, zero falhas/erros; JaCoCo gerado; SpotBugs com zero achados. |
| Documentação e diff | Configuração de execução, instruções e whitespace do diff | Revisão dos READMEs; `git diff --check` | **PASSOU** | README da raiz e do frontend descrevem Compose, Vite, proxy, portas e autenticação. |
| Inspeção de console e regressões visuais completas | Console JavaScript, vários viewports, Login/Registro visuais, mapa e formulário submetido no navegador | Não executado | **NÃO EXECUTADO** | Não impede as validações HTTP e automatizadas; permanece uma limitação da validação visual. |
| Serviços públicos de endereço/geocodificação | Falhas reais, retry/rate limit contra serviços externos e conclusão de geocodificação | Não executado manualmente; testes usam mocks | **NÃO EXECUTADO** | Evitou-se depender de respostas externas e gerar chamadas desnecessárias. Tiles do mapa também não foram visualmente verificados. |

## Problemas corrigidos

1. O Compose não incluía o frontend; foi adicionado build multi-stage Node/Nginx com fallback SPA, proxy `/api` e Upgrade WebSocket em `/ws`.
2. O cliente HTTP usava `http://localhost:8080` como padrão de produção; passou a usar caminhos relativos e o Vite recebeu proxies equivalentes para desenvolvimento.
3. O backend não tinha healthcheck utilizável pelo Compose; foi adicionado healthcheck de readiness Actuator e o frontend aguarda o backend saudável.
4. O healthcheck do backend precisa de `curl` na imagem runtime; a imagem o instala durante o build.
5. A origem única do backend não permitia servir Compose e Vite ao mesmo tempo. `FRONTEND_ORIGIN` agora aceita uma lista separada por vírgulas, usada tanto por CORS quanto pelo endpoint STOMP; o exemplo local contém as duas origens.
6. O `.dockerignore` do backend não excluía `.env`; ambientes e arquivos de chave foram excluídos do contexto Docker.
7. Um teste de frontend ainda esperava WebSocket direto em `localhost:8080`; foi atualizado para o host same-origin e acrescentada uma verificação para a base HTTP relativa.
8. O healthcheck do Nginx tentava `localhost`, resolvido para `::1` no Alpine enquanto o Nginx escuta IPv4; foi fixado em `127.0.0.1` e confirmado como saudável.

## Riscos e limitações remanescentes

- O logout revoga a sessão de refresh e o frontend limpa token/cache e encerra a conexão, mas um access token já emitido continua válido até expirar (padrão `3600` segundos). A invalidação imediata exigiria uma estratégia de revogação de JWT que não faz parte da arquitetura atual; não foi alterada nesta estabilização.
- O `FRONTEND_ORIGIN` precisa listar as origens exatas usadas no navegador. Em produção, configure domínio e protocolo reais e use HTTPS com `AUTH_COOKIE_SECURE=true`.
- O navegador usou uma sessão previamente existente. Login e sessão foram exercitados por HTTP; não foi feito login visual nem logout visual.
- ViaCEP, Nominatim e tiles do OpenStreetMap dependem de serviços externos. Resultados e falhas reais não foram validados nesta execução; os cenários automatizados usam mocks.
- O cenário HTTP criou dois usuários e pedidos de teste no banco já existente. Eles foram deixados intactos; não há endpoint de limpeza e nenhum dado foi apagado.
- A porta 8080 ocupada exige `BACKEND_PORT` alternativo neste ambiente. Em uma máquina sem esse conflito, o padrão documentado é backend `8080` e frontend `3000`.

## Estado final

O build e o Compose foram iniciados com sucesso, os três serviços estavam saudáveis, os testes automatizados passaram e os caminhos HTTP/STOMP críticos foram confirmados pelo endereço publicado do frontend. Login visual, console do navegador, conclusão real do Nominatim/mapa e invalidação imediata do bearer no logout permanecem fora do que foi comprovado nesta execução; portanto, a aplicação não é declarada integralmente validada nesses pontos.
