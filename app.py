import streamlit as st
import pandas as pd
import sqlite3
import hashlib
import os
from datetime import datetime
import plotly.express as px
import json

# --- CONFIGURACIÓN DE LA PÁGINA ---
st.set_page_config(page_title="Sistema de Archivo Inteligente", layout="wide", page_icon="🗄️")

# --- GESTIÓN DE BASE DE DATOS (SQLite) ---
def init_db():
    conn = sqlite3.connect('archivo_data.db')
    c = conn.cursor()
    # Tabla de Usuarios
    c.execute('''CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)''')
    # Tabla de Registros (Archivos)
    c.execute('''CREATE TABLE IF NOT EXISTS records 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  user TEXT, 
                  category TEXT, 
                  title TEXT, 
                  dynamic_data TEXT, 
                  filename TEXT, 
                  timestamp DATETIME)''')
    # Tabla de Logs de Acceso
    c.execute('''CREATE TABLE IF NOT EXISTS access_logs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, action TEXT, timestamp DATETIME)''')
    conn.commit()
    return conn

def make_hashes(password):
    return hashlib.sha256(str.encode(password)).hexdigest()

def check_hashes(password, hashed_text):
    if make_hashes(password) == hashed_text:
        return hashed_text
    return False

# Crear usuario admin por defecto si no existe
conn = init_db()
c = conn.cursor()
c.execute("SELECT * FROM users WHERE username = 'admin'")
if not c.fetchone():
    c.execute("INSERT INTO users (username, password) VALUES (?, ?)", ('admin', make_hashes('admin123')))
    conn.commit()

# --- FUNCIONES DEL SISTEMA ---
def add_log(user, action):
    c = conn.cursor()
    c.execute("INSERT INTO access_logs (user, action, timestamp) VALUES (?, ?, ?)", 
              (user, action, datetime.now()))
    conn.commit()

def save_record(user, category, title, dynamic_data, filename):
    c = conn.cursor()
    c.execute("INSERT INTO records (user, category, title, dynamic_data, filename, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              (user, category, title, json.dumps(dynamic_data), filename, datetime.now()))
    conn.commit()

# --- INTERFAZ DE USUARIO ---

def main():
    # Estilos CSS simples
    st.markdown("""
    <style>
    .main {background-color: #f5f5f5;}
    .stButton>button {width: 100%;}
    </style>
    """, unsafe_allow_html=True)

    # --- SISTEMA DE LOGIN ---
    if 'logged_in' not in st.session_state:
        st.session_state['logged_in'] = False

    if not st.session_state['logged_in']:
        col1, col2, col3 = st.columns([1,1,1])
        with col2:
            st.title("🔒 Acceso al Archivo")
            username = st.text_input("Usuario")
            password = st.text_input("Contraseña", type='password')
            if st.button("Ingresar"):
                c.execute('SELECT * FROM users WHERE username =? AND password = ?', (username, make_hashes(password)))
                if c.fetchall():
                    st.session_state['logged_in'] = True
                    st.session_state['username'] = username
                    add_log(username, "Login Exitoso")
                    st.rerun()
                else:
                    st.error("Usuario o contraseña incorrectos")
            st.info("Nota: Usuario por defecto: `admin` / Contraseña: `admin123`")

    else:
        # --- APLICACIÓN PRINCIPAL ---
        sidebar_option = st.sidebar.selectbox("Menú Principal", ["Dashboard Inteligente", "Nuevo Registro", "Consultar Archivos", "Logs de Auditoría", "Cerrar Sesión"])
        
        st.sidebar.markdown("---")
        st.sidebar.write(f"👤 Usuario: **{st.session_state['username']}**")

        # 1. DASHBOARD INTELIGENTE
        if sidebar_option == "Dashboard Inteligente":
            st.title("📊 Dashboard General")
            
            # Cargar datos
            df = pd.read_sql_query("SELECT * FROM records", conn)
            
            if not df.empty:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                
                # Métricas KPI
                kpi1, kpi2, kpi3 = st.columns(3)
                kpi1.metric("Total Archivos", len(df))
                kpi2.metric("Categorías Únicas", df['category'].nunique())
                kpi3.metric("Último Registro", df['timestamp'].max().strftime('%d/%m/%Y'))

                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("Registros por Categoría")
                    fig_pie = px.pie(df, names='category', hole=0.4)
                    st.plotly_chart(fig_pie, use_container_width=True)

                with col2:
                    st.subheader("Actividad en el Tiempo")
                    activ_per_day = df.groupby(df['timestamp'].dt.date).size().reset_index(name='counts')
                    fig_bar = px.bar(activ_per_day, x='timestamp', y='counts')
                    st.plotly_chart(fig_bar, use_container_width=True)
            else:
                st.info("No hay datos suficientes para mostrar el dashboard. Ve a 'Nuevo Registro'.")

        # 2. NUEVO REGISTRO (DINÁMICO)
        elif sidebar_option == "Nuevo Registro":
            st.title("📂 Ingresar Documento")
            
            with st.form("entry_form", clear_on_submit=True):
                col1, col2 = st.columns(2)
                with col1:
                    category = st.selectbox("Departamento / Categoría", ["Finanzas", "Recursos Humanos", "Legal", "Operaciones", "Otro"])
                with col2:
                    title = st.text_input("Título del Documento")

                st.markdown("### 🛠 Campos Dinámicos")
                st.caption("Agrega información extra específica para este registro.")
                
                # Simulación de campos dinámicos
                c_din1, c_din2 = st.columns(2)
                key1 = c_din1.text_input("Nombre del Campo 1 (Ej: Proveedor)")
                val1 = c_din2.text_input("Valor del Campo 1")
                
                key2 = c_din1.text_input("Nombre del Campo 2 (Ej: Monto)")
                val2 = c_din2.text_input("Valor del Campo 2")
                
                uploaded_file = st.file_uploader("Adjuntar Archivo (PDF, DOCX, PNG)", type=['pdf', 'docx', 'png', 'jpg'])
                
                submitted = st.form_submit_button("Guardar Registro")
                
                if submitted:
                    if title:
                        file_name = uploaded_file.name if uploaded_file else "Sin adjunto"
                        # Guardar el archivo físicamente (opcional, aquí solo guardamos el nombre)
                        if uploaded_file:
                            if not os.path.exists("archivos_subidos"):
                                os.makedirs("archivos_subidos")
                            with open(os.path.join("archivos_subidos", uploaded_file.name), "wb") as f:
                                f.write(uploaded_file.getbuffer())

                        # Crear diccionario dinámico
                        dynamic_dict = {}
                        if key1: dynamic_dict[key1] = val1
                        if key2: dynamic_dict[key2] = val2
                        
                        save_record(st.session_state['username'], category, title, dynamic_dict, file_name)
                        st.success("¡Registro guardado exitosamente!")
                    else:
                        st.error("El título es obligatorio.")

        # 3. CONSULTAR ARCHIVOS (TABS DINÁMICOS)
        elif sidebar_option == "Consultar Archivos":
            st.title("🗂 Repositorio de Archivos")
            
            df = pd.read_sql_query("SELECT * FROM records", conn)
            
            if not df.empty:
                # Obtener categorías únicas para crear TABS
                categorias = df['category'].unique().tolist()
                tabs = st.tabs(["TODOS"] + categorias)
                
                # Tab General
                with tabs[0]:
                    st.dataframe(df)

                # Tabs por Categoría
                for i, cat in enumerate(categorias):
                    with tabs[i+1]:
                        st.subheader(f"Archivos de {cat}")
                        filtered_df = df[df['category'] == cat]
                        
                        for index, row in filtered_df.iterrows():
                            with st.expander(f"{row['timestamp']} - {row['title']}"):
                                st.write(f"**Usuario:** {row['user']}")
                                st.write(f"**Archivo:** {row['filename']}")
                                
                                # Mostrar datos dinámicos
                                d_data = json.loads(row['dynamic_data'])
                                if d_data:
                                    st.markdown("#### Detalles:")
                                    for k, v in d_data.items():
                                        st.write(f"- **{k}:** {v}")

            else:
                st.warning("Aún no hay registros.")

        # 4. LOGS DE AUDITORÍA
        elif sidebar_option == "Logs de Auditoría":
            st.title("🛡 Logs de Acceso y Seguridad")
            if st.session_state['username'] == 'admin':
                logs_df = pd.read_sql_query("SELECT * FROM access_logs ORDER BY timestamp DESC", conn)
                st.dataframe(logs_df, use_container_width=True)
            else:
                st.error("Acceso restringido solo para administradores.")

        # 5. CERRAR SESIÓN
        elif sidebar_option == "Cerrar Sesión":
            add_log(st.session_state['username'], "Logout")
            st.session_state['logged_in'] = False
            st.rerun()

if __name__ == '__main__':
    main()
