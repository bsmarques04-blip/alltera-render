import os
import sys

# Garante que a pasta atual está no path para os imports da app funcionarem
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from PlataformaApoioDecisaoComercial.app import create_app, create_user_record, db
from PlataformaApoioDecisaoComercial.models import User

app = create_app()

with app.app_context():
    email = "miriam@alltera.pt"
    
    # 1. Verifica se a utilizadora já existe, e se não, efetiva a criação
    user = User.query.filter_by(email=email).first()
    if not user:
        print("A inserir a utilizadora Miriam na base de dados...")
        create_user_record(
            nome="Miriam",
            email=email,
            password="Miriam2026!",
            role="comercial"
        )
    
    # 2. Query de verificação exata na tabela 'user' (nome definido pelo SQLAlchemy)
    query = db.text("SELECT id, nome, email, role, ativo FROM user WHERE email = :email")
    result = db.session.execute(query, {"email": email}).fetchone()
    
    # 3. Mostrar o resultado final formatado
    print("\n--- Resultado da Query ---")
    if result:
        print(f"id: {result[0]}\nnome: {result[1]}\nemail: {result[2]}\nrole: {result[3]}\nativo: {bool(result[4])}")
    else:
        print("Erro: A utilizadora Miriam não foi encontrada na tabela.")