# Alltera MVP

Plataforma web academica para apoio a decisao comercial da Alltera: importa leads de Excel, mostra tabela e mapa, filtra oportunidades e sugere um plano diario de visitas.

## Como correr localmente

1. Instalar Node.js LTS: https://nodejs.org/
2. Abrir terminal nesta pasta:

```bash
cd alltera-mvp
npm install
npm run dev
```

3. Abrir `http://localhost:3000`.

## Formato esperado do Excel Alltera

A primeira folha do `.xlsx` deve conter estes cabecalhos:

- `nome_empresa`
- `tipo_cliente`
- `morada`
- `codigo_postal`
- `localidade`
- `contacto`
- `email`
- `telefone`
- `estado_lead`
- `prioridade`
- `observacoes`
- `latitude`
- `longitude`

Campos obrigatorios nesta versao: `nome_empresa`, `tipo_cliente`, `morada`,
`codigo_postal`, `localidade`, `telefone`, `estado_lead`, `prioridade`,
`latitude` e `longitude`.

Estados aceites: `Nova`, `Contactada`, `Qualificada`, `Visita agendada` e
`Sem interesse`. Prioridades aceites: `Alta`, `Media` e `Baixa`.

## Funcionalidades

- Upload de ficheiro Excel `.xlsx`
- Validacao dos dados antes de guardar
- Detecao de duplicados por `nome_empresa + telefone`
- Normalizacao de `localidade` e `estado_lead`
- Confirmacao manual da importacao
- API routes Next.js para guardar leads em memoria
- Tabela de leads com filtros por localidade, tipo de cliente e estado
- Mapa Leaflet/OpenStreetMap com pins
- Pagina de Planeamento Comercial com localidade, raio, prioridade minima e maximo de visitas
- Sugestao de visitas com Haversine, sem APIs pagas
- Dashboard com KPIs principais

## Logica de planeamento

O planeamento comercial usa uma regra simples e transparente para contexto academico:

1. Considera apenas leads com estado `Nova` ou `Contactada`.
2. Filtra pela localidade escolhida.
3. Respeita a prioridade minima escolhida.
4. Calcula distancias aproximadas entre leads com a formula de Haversine.
5. Cria grupos de leads dentro do raio definido.
6. Escolhe o melhor grupo por total de visitas, prioridade acumulada e proximidade.
7. Ordena a rota por prioridade e distancia ate a proxima visita.

## Nota tecnica

Os dados sao mantidos em memoria no servidor Next.js. Para alojamento real, o proximo passo natural e trocar `lib/store.ts` por SQLite/PostgreSQL, mantendo a mesma interface de API.
