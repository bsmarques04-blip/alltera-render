from app import app
from admin_views import login, logout, admin_panel

# Rota de login/logout
app.add_url_rule("/login", view_func=login, methods=["GET", "POST"])
app.add_url_rule("/logout", view_func=logout)

# Painel admin
app.add_url_rule("/admin", view_func=admin_panel)
