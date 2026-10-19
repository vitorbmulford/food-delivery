# Pedidos

O módulo consome a API autenticada de pedidos com o cliente Axios compartilhado e as queries/mutations do TanStack Query. As respostas vêm da API; a interface não usa pedidos locais ou fictícios.

## Organização

- `api/`: listagem, consulta, criação e atualização de status.
- `components/`: listagem desktop/mobile, status, progresso, timeline e ações permitidas.
- `hooks/`: query keys, consulta de detalhes/histórico e mutations com invalidação do cache.
- `schemas/`: validação do DTO de criação com Zod.
- `types/`: contratos de resposta, criação e status.
- `utils/`: rótulos, formatação BRL/data e mensagens de erro.

## API usada

- `GET /api/orders?page=0&size=10&status=...`: página zero based, tamanho até 50 e status opcional. A ordenação é fixa pelo backend, do mais recente para o mais antigo.
- `GET /api/orders/{id}`: resumo do pedido.
- `GET /api/orders/{id}/history`: eventos de status em ordem cronológica (`id`, `previousStatus`, `newStatus`, `changedAt`, `changedBy`). O evento inicial tem `previousStatus: null`; `changedBy` contém somente o UUID do usuário.
- `POST /api/orders`: `items` (`productName`, `quantity`, `unitPrice`) e `deliveryAddress` (`street`, `number`, `complement`, `neighborhood`, `city`, `state`, `postalCode`). A API calcula o total.
- `PATCH /api/orders/{id}/status`: recebe `{ "status": "..." }`.

Os status aceitos são `RECEBIDO`, `EM_PREPARO`, `SAIU_PARA_ENTREGA`, `ENTREGUE` e `CANCELADO`. Transições: recebido para preparo ou cancelado; preparo para saiu para entrega ou cancelado; saiu para entrega para entregue. Entregue e cancelado são finais. A API responde `409` para transição inválida ou atualização concorrente.

`/orders/:id` valida o formato UUID antes de consultar, mostra os campos existentes do DTO (cliente, itens, endereço, total, criação e atualização), o fluxo possível em um indicador e as mudanças reais na timeline. `404` representa tanto pedido inexistente quanto pedido de outro proprietário. Falha do histórico não oculta os dados principais. Em `409`, detalhes, histórico e listagens são invalidados para buscar o estado atual; após sucesso, a resposta atualiza os detalhes e o histórico/listagens são reconsultados. O cliente Axios e o fluxo de sessão compartilhados preservam o tratamento de `401` e a limpeza do cache no logout.

A resposta da listagem contém `content` e o objeto `page`, que agrupa `number`, `size`, `totalElements` e `totalPages`.

Os filtros de status e a página ficam nos parâmetros da URL. O cache das queries privadas é limpo pelo fluxo de logout já existente, inclusive quando a sessão expira.

No formulário de criação, um CEP válido é consultado diretamente no ViaCEP com debounce de 500 ms e timeout de oito segundos. O resultado pode preencher rua, bairro, cidade e UF; esses campos continuam editáveis. Se o serviço falhar ou não encontrar o CEP, o preenchimento manual permanece disponível. O CEP mascarado (`00000-000`) segue no campo `postalCode` já aceito pelo backend. A geocodificação do pedido após a criação continua a cargo do Spring Boot.

## Testes e limites

Execute `npm run test:run` no diretório `frontend/`. Os testes usam mocks locais, sem serviço externo. A validação de integração com um backend ativo depende de API, banco e credenciais de teste disponíveis.
