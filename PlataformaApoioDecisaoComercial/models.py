from datetime import datetime
import unicodedata
import json

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome_cliente = db.Column(db.String(180), nullable=True)
    area_negocio = db.Column(db.String(120), nullable=True)
    cidade = db.Column(db.String(80), nullable=True)
    empresa = db.Column(db.String(180), nullable=True)
    nome_empresa = db.Column(db.String(180), nullable=False)
    tipo_cliente = db.Column(db.String(80), nullable=False)
    morada = db.Column(db.String(220), nullable=True)
    codigo_postal = db.Column(db.String(20), nullable=True)
    localidade = db.Column(db.String(80), nullable=False)
    contacto = db.Column(db.String(120), nullable=True)
    telefone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(160), nullable=True)
    categoria = db.Column(db.String(120), nullable=True)
    nif = db.Column(db.String(30), nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    observacoes_contacto = db.Column(db.Text, nullable=True)
    reuniao_info = db.Column(db.Text, nullable=True)
    classificacao_observacao = db.Column(db.String(80), nullable=True)
    motivo_classificacao = db.Column(db.Text, nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    estado = db.Column(db.String(40), nullable=False, default="Por contactar")
    estado_lead = db.Column(db.String(40), nullable=True, default="Por contactar")
    prioridade = db.Column(db.String(20), nullable=True, default="Baixa")
    comercial_responsavel = db.Column(db.String(80), nullable=False, default="Flávia")
    data_novo_contacto = db.Column(db.Date, nullable=True)
    data_reuniao = db.Column(db.Date, nullable=True)
    hora_reuniao = db.Column(db.String(10), nullable=True)
    tags = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    historico = db.relationship(
        "HistoricoLead",
        backref="lead",
        cascade="all, delete-orphan",
        order_by="desc(HistoricoLead.created_at)",
    )

    def to_dict(self, include_history=False):
        data = {
            "id": self.id,
            "nome_cliente": self.nome_cliente or self.nome_empresa,
            "area_negocio": self.area_negocio or self.tipo_cliente,
            "cidade": self.cidade or self.localidade,
            "empresa": self.empresa or "",
            "nome_empresa": self.nome_empresa,
            "tipo_cliente": self.tipo_cliente,
            "morada": self.morada or "",
            "codigo_postal": self.codigo_postal or "",
            "localidade": self.localidade,
            "contacto": self.contacto or "",
            "telefone": self.telefone or "",
            "email": self.email or "",
            "categoria": self.categoria or "",
            "nif": self.nif or "",
            "observacoes": self.observacoes or "",
            "observacoes_contacto": self.observacoes_contacto or "",
            "reuniao_info": self.reuniao_info or "",
            "classificacao_observacao": self.classificacao_observacao or "",
            "motivo_classificacao": self.motivo_classificacao or "",
            "latitude": self.latitude,
            "longitude": self.longitude,
            "estado": self.estado,
            "prioridade": self.prioridade or "",
            "comercial_responsavel": self.comercial_responsavel,
            "data_novo_contacto": self.data_novo_contacto.isoformat() if self.data_novo_contacto else "",
            "data_reuniao": self.data_reuniao.isoformat() if self.data_reuniao else "",
            "hora_reuniao": self.hora_reuniao or "",
            "tags": self.tag_list(),
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else "",
            "score": self.operational_score(),
            "score_band": self.priority_band(),
        }
        if include_history:
            data["historico"] = [item.to_dict() for item in self.historico]
        return data

    def tag_list(self):
        return [tag.strip() for tag in (self.tags or "").split(",") if tag.strip()]

    def _normalized_text(self, value):
        text = unicodedata.normalize("NFD", str(value or "").lower())
        text = "".join(char for char in text if unicodedata.category(char) != "Mn")
        return text

    def last_contact_age_days(self):
        if not self.historico:
            return None
        latest = None
        for item in self.historico:
            if not item.created_at:
                continue
            if latest is None or item.created_at > latest:
                latest = item.created_at
        if latest is None:
            return None
        return max(0, (datetime.utcnow() - latest).days)

    def operational_score(self):
        score = 45
        estado = self._normalized_text(self.estado)
        obs = self._normalized_text(" ".join(filter(None, [self.observacoes, self.observacoes_contacto, self.reuniao_info])))
        age = self.last_contact_age_days()

        if self.telefone or self.email:
            score += 10
        if not self.comercial_responsavel or self._normalized_text(self.comercial_responsavel) in {"", "outro", "sem comercial", "sem comercial atribuido"}:
            score += 8

        if any(token in obs for token in ["reuniao marcada", "reunião marcada", "agendado", "marcado para", "visita marcada", "confirmada reuniao", "confirmada reunião"]):
            score += 22
        if any(token in obs for token in ["ligar depois", "voltar a contactar", "proximo mes", "próximo mês", "outono", "setembro"]):
            score += 12
        if any(token in obs for token in ["nao atendeu", "não atendeu", "sem resposta", "chamada perdida"]):
            score -= 12
        if any(token in estado for token in ["sem interesse"]):
            score -= 30
        if "ja tratado" in estado or "jatratado" in estado or "crm" in estado:
            score -= 25
        if age is not None:
            if age <= 2:
                score += 20
            elif age <= 7:
                score += 10
            elif age <= 30:
                score -= 5
            else:
                score -= 15
        if not self.latitude or not self.longitude:
            score -= 5

        return max(0, min(100, score))

    def priority_band(self):
        score = self.operational_score()
        if score >= 70:
            return "Alta prioridade"
        if score >= 40:
            return "Média prioridade"
        return "Baixa prioridade"


class HistoricoLead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lead_id = db.Column(db.Integer, db.ForeignKey("lead.id"), nullable=False)
    acao = db.Column(db.String(120), nullable=False)
    observacao = db.Column(db.Text, nullable=True)
    comercial_responsavel = db.Column(db.String(80), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "acao": self.acao,
            "observacao": self.observacao or "",
            "comercial_responsavel": self.comercial_responsavel or "",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
        }


class PossivelDuplicado(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lead_id = db.Column(db.Integer, db.ForeignKey("lead.id"), nullable=False)
    dados_importados = db.Column(db.Text, nullable=False)
    motivo = db.Column(db.String(160), nullable=False)
    estado = db.Column(db.String(30), nullable=False, default="Pendente")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lead = db.relationship("Lead", backref="duplicados_suspeitos")

    def imported_data(self):
        try:
            return json.loads(self.dados_importados)
        except json.JSONDecodeError:
            return {}


class PlanoReunioes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    comercial = db.Column(db.String(80), nullable=False)
    data = db.Column(db.Date, nullable=False)
    observacao = db.Column(db.Text, nullable=True)
    total_leads = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class GeocodingCache(db.Model):
    __tablename__ = "geocoding_cache"

    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column("query", db.String(300), nullable=False, unique=True, index=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
