import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import MetaData, Table, create_engine, func, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError


BASE_DIR = Path(__file__).resolve().parent
SQLITE_PATH = BASE_DIR / "PlataformaApoioDecisaoComercial" / "instance" / "decisao_comercial.db"
SQLITE_URI = f"sqlite:///{SQLITE_PATH.as_posix()}"


def normalize_database_url():
    load_dotenv(BASE_DIR / ".env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL nao esta definida. Configure-a antes de correr a migracao.")
    database_url = database_url.replace("postgres://", "postgresql://", 1)
    os.environ["DATABASE_URL"] = database_url
    return database_url


def get_application_context():
    normalize_database_url()

    from PlataformaApoioDecisaoComercial.app import app
    from PlataformaApoioDecisaoComercial.models import db

    return app, db


def ensure_sqlite_exists():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(f"Base de dados SQLite nao encontrada: {SQLITE_PATH}")


def table_count(connection, table):
    return connection.execute(select(func.count()).select_from(table)).scalar_one()


def existing_primary_keys(connection, table):
    primary_keys = list(table.primary_key.columns)
    if not primary_keys:
        return set()

    rows = connection.execute(select(*primary_keys)).all()
    if len(primary_keys) == 1:
        return {row[0] for row in rows}
    return {tuple(row) for row in rows}


def row_primary_key(row_data, primary_keys):
    if len(primary_keys) == 1:
        return row_data[primary_keys[0].name]
    return tuple(row_data[column.name] for column in primary_keys)


def copy_table(source_connection, target_connection, table):
    source_table = Table(table.name, MetaData(), autoload_with=source_connection)
    primary_keys = list(table.primary_key.columns)
    target_keys = existing_primary_keys(target_connection, table)

    pending_rows = []
    skipped_rows = 0
    table_columns = [column.name for column in table.columns if column.name in source_table.c]
    source_columns = [source_table.c[column] for column in table_columns]
    source_rows = source_connection.execute(select(*source_columns)).mappings()

    for source_row in source_rows:
        row_data = {column: source_row[column] for column in table_columns}
        has_primary_key = primary_keys and all(column.name in row_data for column in primary_keys)
        if has_primary_key and row_primary_key(row_data, primary_keys) in target_keys:
            skipped_rows += 1
            continue
        pending_rows.append(row_data)

    if pending_rows:
        target_connection.execute(table.insert(), pending_rows)

    return len(pending_rows), skipped_rows


def reset_postgres_sequences(connection, db):
    preparer = db.engine.dialect.identifier_preparer
    for table in db.metadata.sorted_tables:
        primary_keys = list(table.primary_key.columns)
        if len(primary_keys) != 1:
            continue

        primary_key = primary_keys[0]
        try:
            is_integer_key = primary_key.type.python_type is int
        except NotImplementedError:
            is_integer_key = False
        if not is_integer_key:
            continue

        quoted_table = preparer.quote(table.name)
        quoted_column = preparer.quote(primary_key.name)
        connection.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence(:table_name, :column_name),
                    COALESCE((SELECT MAX({column_name}) FROM {table_name}), 1),
                    (SELECT MAX({column_name}) FROM {table_name}) IS NOT NULL
                )
                """.format(
                    table_name=quoted_table,
                    column_name=quoted_column,
                )
            ),
            {"table_name": table.name, "column_name": primary_key.name},
        )


def print_counts(title, connection, tables):
    print(title)
    for table in tables:
        print(f"  {table.name}: {table_count(connection, table)}")


def main():
    ensure_sqlite_exists()
    app, db = get_application_context()

    sqlite_engine = create_engine(SQLITE_URI)

    with app.app_context():
        if not db.engine.url.drivername.startswith("postgresql"):
            raise RuntimeError(f"A base de dados destino nao e PostgreSQL: {db.engine.url}")

        db.create_all()
        tables = list(db.metadata.sorted_tables)

        source_inspector = inspect(sqlite_engine)
        source_table_names = set(source_inspector.get_table_names())
        tables = [table for table in tables if table.name in source_table_names]

        if not tables:
            raise RuntimeError("Nenhuma tabela dos modelos foi encontrada na SQLite local.")

        with sqlite_engine.connect() as source_connection:
            with db.engine.connect() as target_connection:
                with target_connection.begin():
                    print_counts("SQLite antes da migracao:", source_connection, tables)
                    print_counts("PostgreSQL antes da migracao:", target_connection, tables)

                    print("A migrar tabelas:")
                    for table in tables:
                        inserted, skipped = copy_table(source_connection, target_connection, table)
                        print(f"  {table.name}: {inserted} inseridos, {skipped} ignorados por duplicado")

                    reset_postgres_sequences(target_connection, db)

                    print_counts("PostgreSQL depois da migracao:", target_connection, tables)

    print("Migracao concluida com sucesso.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, FileNotFoundError, SQLAlchemyError) as exc:
        print(f"Erro na migracao: {exc}", file=sys.stderr)
        sys.exit(1)
