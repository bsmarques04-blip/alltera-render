# Alltera Lead Planner

Plataforma web Flask para consolidar leads vindas de Excel/CSV e apoiar o planeamento comercial geográfico da Alltera.

A aplicação foca-se em qualidade de dados, mapa de leads, histórico de contactos e planeamento de visitas por proximidade, mantendo um âmbito operacional.

## Objetivo do projeto

A Alltera trabalha com leads B2B de restaurantes, hotéis e outros clientes empresariais. O Alltera Lead Planner digitaliza o processo que antes dependia de folhas Excel, permitindo:

- importar e consolidar leads;
- evitar contactos repetidos;
- posicionar leads no mapa pela cidade;
- selecionar uma lead e encontrar contactos próximos;
- criar um plano de contactos do dia;
- exportar o plano;
- manter histórico das decisões comerciais.

## Como correr localmente

```powershell
cd PlataformaApoioDecisaoComercial
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Depois abrir:

```text
http://127.0.0.1:5000
```

## Formato Excel/CSV aceite

A importação aceita o formato real usado pela Alltera e também folhas antigas/desorganizadas. Em ficheiros `.xlsx`, a aplicação percorre todas as folhas, ignora folhas vazias/técnicas e tenta encontrar automaticamente a linha real de cabeçalho.

Exemplos de folhas aceites:

- `ASS. T. CLIENTES ACTIVOS`;
- `PENDENTES`;
- `CLIENTES HORECA`;
- `VENDAS PARTICULAR`.

Colunas do formato atual:

```text
Comercial
Categoria
Área de negócio
Nome Cliente
Contacto telefónico
email
Empresa
NIF
Cidade
Observações
Reunião
Observações do contacto
```

Se algumas colunas não existirem, a importação continua e guarda a informação disponível.

Também são aceites variações antigas, por exemplo:

- `NOME` para nome da lead;
- `MORADA` para morada;
- `COD. P.`, `COD P`, `CP`, `CÓDIGO POSTAL` para código postal;
- `LOCALIDADE`, `CIDADE`, `CONCELHO` para localidade;
- `CONTACTO`, `TELEFONE`, `TELEMÓVEL`, `TEL` para telefone;
- `OBS`, `OBSERVAÇÕES`, `NOTAS` para observações;
- `ASSIST. T.`, `ASSISTÊNCIA` para categoria/tipo.

Regras principais:

- `Nome Cliente` é o nome principal da lead;
- se `Nome Cliente` estiver vazio, usa `Empresa`;
- `Área de negócio` é usada como tipo/área principal;
- se `Área de negócio` estiver vazia, usa `Categoria`;
- se `Cidade` estiver vazia, guarda `Sem cidade`;
- duplicados são detetados por `Nome Cliente + Contacto telefónico` ou `Empresa + Contacto telefónico`.

## Geocoding por cidade/região

A aplicação usa Nominatim/OpenStreetMap, gratuito, para obter coordenadas aproximadas com base na cidade.

A pesquisa dá prioridade à informação mais completa disponível:

1. morada + código postal + localidade;
2. morada + localidade;
3. código postal + localidade;
4. código postal;
5. localidade/cidade;
6. fallback regional quando aplicável.

Quando só existe cidade, a pesquisa usa:

```text
Cidade normalizada, Portugal
```

Antes de pesquisar, a cidade é normalizada. Exemplos:

- `Albufeira - Algarve` passa a `Albufeira`;
- `Borba - Alentejo` passa a `Borba`;
- `Lagoa Algarve` passa a `Lagoa`;
- `Lisboas` passa a `Lisboa`;
- `Setuball` passa a `Setúbal`.

As coordenadas ficam em cache SQLite para evitar chamadas repetidas à mesma cidade. Se uma cidade não for encontrada, a lead é importada na mesma, mas não aparece no mapa até ser corrigida.

## Mapa de Leads

O mapa usa Leaflet com OpenStreetMap.

No mapa:

- azul representa lead ativa;
- verde representa lead selecionada;
- laranja representa lead próxima;
- cinzento representa lead histórica/inativa.

Ao clicar numa lead, o painel lateral mostra os detalhes e calcula leads próximas dentro do raio operacional selecionado.

Funcionalidades operacionais adicionais:

- zona recomendada do dia, calculada pela maior concentração de leads ativas;
- aviso de leads sem contacto recente;
- badge de contacto recente para evitar chamadas repetidas;
- heatmap de concentração;
- clusters quando há muitas leads próximas;
- modo operacional e modo apresentação para uso no terreno ou demonstração.

## Raio operacional

O raio operacional é editável entre 1 km e 50 km.

Serve para:

- atualizar o círculo no mapa;
- recalcular leads próximas;
- gerar o plano de contactos do dia;
- apoiar a decisão sobre quais contactos visitar na mesma zona.

## Plano de contactos

No painel da lead selecionada, o botão `Criar plano de contactos do dia` cria um plano visual com:

- lead base;
- leads próximas;
- distância aproximada;
- telefone;
- cidade;
- total de contactos;
- raio usado.

Quando há plano criado, é possível exportar para Excel.

A exportação gera um ficheiro Excel com título, metadados do plano, cabeçalhos formatados e cores alinhadas com a identidade visual da Alltera.

## Regras de estado

Estados usados:

- Por contactar;
- Contactado;
- Ligar de volta;
- Adiar contacto;
- Reunião marcada;
- Sem interesse definitivo;
- Cliente existente.

### Reunião marcada

Quando uma lead passa para `Reunião marcada`, deixa de aparecer no planeamento ativo para evitar que outro comercial volte a contactar a mesma pessoa.

### Adiar contacto

Quando a resposta é “agora não”, “ligar mais tarde” ou semelhante, a lead passa para `Adiar contacto`. Se existir uma data futura, só volta a aparecer quando essa data chegar.

## Histórico

O histórico regista ações como:

- importação;
- alteração de estado;
- reunião marcada;
- contacto adiado;
- plano criado;
- exportação de plano;
- deteção de duplicados.

Quando o Excel antigo traz colunas `DIA`, `MÊS` e `ANO`, a aplicação reconstrói a data de contacto e cria um registo histórico para apoiar os badges de contacto recente.

A página de Histórico permite filtrar por tipo de ação.

## Sobre o Sistema

A página `Sobre` resume o objetivo, arquitetura, importação, geocoding, planeamento geográfico, regras operacionais e valor académico/empresarial do sistema.

## Valor académico e operacional

Este projeto demonstra conceitos de Gestão de Sistemas de Informação:

- digitalização de processos comerciais;
- consolidação de dados vindos de Excel;
- qualidade e normalização de dados;
- apoio à decisão comercial;
- utilização de dados geográficos;
- planeamento operacional por proximidade;
- redução de deslocações desnecessárias;
- rastreabilidade através de histórico.

O sistema foi pensado como MVP apresentável para estágio final, mantendo uma interface SaaS B2B moderna e uma arquitetura simples em Flask, SQLite, HTML, CSS e JavaScript.
