# Estrutura do Projeto Alltera

Este documento descreve a organizacao atual do projeto Alltera e serve como referencia antes de fazer novas limpezas ou refactors.

## Entrypoint

O ficheiro `app.py` na raiz do repositorio e o entrypoint publico da aplicacao.

Em local, o arranque habitual e:

```bash
python app.py
```

Em producao/Render, o `Procfile` usa:

```text
web: gunicorn app:app
```

Por isso, o ficheiro `app.py` da raiz deve continuar a existir enquanto o `Procfile` apontar para `app:app`. Atualmente este ficheiro funciona como wrapper e importa a app real a partir de `PlataformaApoioDecisaoComercial.app`.

## Aplicacao Flask real

A aplicacao Flask ativa vive em:

```text
PlataformaApoioDecisaoComercial/
```

O ficheiro principal e:

```text
PlataformaApoioDecisaoComercial/app.py
```

E aqui que estao definidos:

- criacao da app Flask;
- configuracao da base de dados;
- inicializacao de extensoes;
- rotas;
- APIs;
- logica principal de leads, mapa, importacao, planeamento, autenticacao e administracao.

O modelo de dados ativo esta em:

```text
PlataformaApoioDecisaoComercial/models.py
```

## Templates ativos

Os templates usados pela app ativa estao em:

```text
PlataformaApoioDecisaoComercial/templates/
```

Esta e a pasta que o Flask usa por defeito, porque a app real e criada dentro de `PlataformaApoioDecisaoComercial/`.

Exemplos de templates ativos:

- `base.html`
- `login.html`
- `registo.html`
- `mapa.html`
- `todas_leads.html`
- `leads_inativas.html`
- `agendadas.html`
- `admin_overview.html`
- `admin_users.html`
- `importar.html`
- `planeamento.html`

Templates fora desta pasta nao devem ser assumidos como ativos.

## Static ativo

Os ficheiros estaticos usados pela app ativa estao em:

```text
PlataformaApoioDecisaoComercial/static/
```

Principais ficheiros ativos:

- `css/styles.css`
- `js/mapa.js`
- `js/planeamento.js`
- `js/animations.js`
- `alltera-logo.png`
- favicons e `site.webmanifest`

Esta e a pasta resolvida por `url_for("static", filename=...)` na app Flask ativa.

## Projeto antigo arquivado

O projeto antigo RessaCar foi arquivado em:

```text
legacy/ressacar/
```

Esta pasta contem ficheiros que existiam anteriormente na raiz e que nao fazem parte da app Flask ativa Alltera:

- `models.py`
- `admin_views.py`
- `urls.py`
- `templates/`
- `static/`

Estes ficheiros devem ser tratados como referencia historica/legacy. Nao devem ser importados pela app Alltera sem uma revisao explicita.

## Scripts auxiliares

Scripts soltos de manutencao ficam em:

```text
scripts/
```

Exemplos:

- `criar_miriam.py`
- `migrate_sqlite_to_postgres.py`

Antes de executar scripts desta pasta, confirmar sempre:

- que base de dados vao usar;
- que variaveis de ambiente esperam;
- se assumem caminhos antigos da raiz.

## Documentacao antiga

Documentos antigos ou relacionados com projetos anteriores ficam em:

```text
docs/legacy/
```

Exemplo:

- `Relatorio_RessaCar.docx`

## Migracoes da base de dados

As migracoes Alembic/Flask-Migrate ficam em:

```text
migrations/
```

Esta pasta deve ser mantida na raiz do projeto. Serve como suporte ao schema da base de dados e deve ser tratada com cuidado, especialmente em ambientes PostgreSQL/Render.

## Cuidados antes de mexer em `app.py`

Antes de alterar `PlataformaApoioDecisaoComercial/app.py`, confirmar:

1. Se a alteracao muda nomes de rotas ou endpoints usados em `url_for`.
2. Se afeta login, permissoes ou decorators de roles.
3. Se afeta APIs usadas pelo mapa, especialmente `/api/leads` e `/api/leads/<id>/action`.
4. Se afeta templates ativos em `PlataformaApoioDecisaoComercial/templates/`.
5. Se afeta ficheiros static ativos em `PlataformaApoioDecisaoComercial/static/`.
6. Se a migracao de base de dados corre antes de qualquer query aos modelos.
7. Se o `Procfile` continua compativel com o wrapper `app.py` da raiz.

Depois de alterar `app.py`, validar pelo menos:

```bash
python app.py
```

E testar:

```text
/login
/mapa
```

Sem sessao autenticada, `/mapa` deve redirecionar para `/login?next=%2Fmapa`.
