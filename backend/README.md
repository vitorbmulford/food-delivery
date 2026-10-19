# Backend — Foody Delivery

## Insights comerciais

`GET /api/insights?from=YYYY-MM-DD&to=YYYY-MM-DD` retorna agregados comerciais e de desempenho para o usuário autenticado. A rota exige o mesmo JWT das demais rotas privadas. Períodos são datas civis inclusivas em `America/Sao_Paulo`, aceitam até 366 dias e não podem terminar no futuro. Limites são convertidos para `[início do primeiro dia, início do dia seguinte ao último dia)` antes das consultas.

### Critérios e fórmulas

- **Valor e quantidade criados:** soma de `orders.total_amount` e contagem usando `orders.created_at` dentro do intervalo.
- **Valor, quantidade, ticket e unidades entregues:** usam a hora do evento `ENTREGUE` no histórico. Ticket é valor entregue dividido pela quantidade de pedidos entregues. As unidades somam `order_items.quantity` desses pedidos.
- **Valor e quantidade cancelados:** usam a hora do evento `CANCELADO` e o valor integral dos pedidos.
- **Em andamento:** soma atual dos pedidos nos status `RECEBIDO`, `EM_PREPARO` e `SAIU_PARA_ENTREGA`, para todos os tempos; não depende do período selecionado.
- **Distribuição por status:** total e quantidade atuais de todos os pedidos da conta, sem restrição temporal.
- **Séries diárias:** pedidos criados são agrupados pela data local de `created_at`; entregas e cancelamentos pela data local do evento correspondente. Dias sem eventos são devolvidos como zero.
- **Produtos:** itens de pedidos entregues no período, agrupados por nome após trim, compactação de espaços consecutivos e minúsculas. Participação é a quantidade do produto dividida pelas unidades vendidas no período. O ranking é limitado aos dez maiores por quantidade.
- **Horário:** contagem de criação de pedidos por hora local.
- **Duração:** população de pedidos entregues no período que possuam os eventos requeridos em ordem cronológica: criação→primeiro `EM_PREPARO`, primeiro `EM_PREPARO`→primeiro `SAIU_PARA_ENTREGA`, primeiro `SAIU_PARA_ENTREGA`→primeiro `ENTREGUE` e criação→primeiro `ENTREGUE`. Cada duração traz seu tamanho de amostra; eventos ausentes ou fora de ordem não contribuem.
- **Comparação:** intervalo imediatamente anterior com o mesmo número de dias. Percentuais são tratados na interface; quando a base anterior é zero, não há percentual.

As somas de pedidos, itens e eventos são consultadas separadamente para evitar dupla contagem por joins. As consultas filtram `owner_id` derivado do `sub` JWT; nenhum identificador de usuário é aceito como parâmetro. Valores representam pedidos, não pagamentos ou receita recebida. Não são calculados lucro, custo ou despesas.

## Operador e cliente

O usuário autenticado é o operador proprietário do pedido. O cliente não tem conta: `customer_name`, `customer_phone` e `customer_email` são um snapshot do contato informado ao criar o pedido, e o endereço do pedido é o endereço de entrega desse cliente. A migration `V8` preserva pedidos existentes com os campos de cliente nulos e renomeia a FK de propriedade para `owner_id`; não há preenchimento artificial com dados do operador.

`POST /api/orders` exige `customer.name` e `customer.phone` (normalizado para 10 ou 11 dígitos) e aceita `customer.email` opcional. `GET /api/orders?search=` aplica, no PostgreSQL e antes da paginação, busca por nome/e-mail, telefone sem máscara ou UUID exato, sempre junto ao escopo do operador autenticado.

### Testes

Execute `./mvnw clean verify` para rodar testes, gerar o relatório JaCoCo e executar o SpotBugs configurado no build. Os testes de agregações usam PostgreSQL via Testcontainers.
