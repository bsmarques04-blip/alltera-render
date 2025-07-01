from flask import render_template, request, redirect, url_for, session, flash

def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "password":
            session["admin"] = True
            flash("Login efetuado com sucesso!", "success")
            return redirect(url_for("admin_panel"))
        else:
            flash("Credenciais inválidas", "danger")

    return render_template("admin_login.html")

def logout():
    session.pop("admin", None)
    flash("Sessão terminada com sucesso", "success")
    return redirect(url_for("login"))

def admin_panel():
    if "admin" not in session:
        return redirect(url_for("login"))
    return render_template("admin_panel.html")
