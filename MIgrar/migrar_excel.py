import pandas as pd

# Leer Excel
file = "F-M-02 Control de Herramientas Compartidas (En desarrollo).xlsx"
df = pd.read_excel(file, sheet_name="Inventario")

# Normalizar nombres de columnas
df.columns = df.columns.str.strip().str.lower()

# Limpiar datos
df = df.fillna("")
df["nombre"] = df["nombre"].str.upper().str.strip()
df["marca"] = df["marca"].str.upper().str.strip()
df["modelo"] = df["modelo"].str.upper().str.strip()
df["tipo"] = df["tipo"].str.upper().str.strip()

# Crear código de contenedor
df["codigo_contenedor"] = (
    df["ubicacion"].astype(str) + "-" +
    df["estante"].astype(str) + "-" +
    df["contenedor"].astype(str)
)

# =========================
# CONTENEDORES
# =========================
contenedores = df[["codigo_contenedor", "ubicacion", "estante", "contenedor"]].drop_duplicates()
contenedores.columns = ["codigo", "ubicacion", "estante", "contenedor"]

contenedores.to_csv("contenedores.csv", index=False)

# =========================
# ITEMS (UNIQUE)
# =========================
items = df[["nombre", "marca", "modelo", "tipo", "detalle"]].drop_duplicates()

items.to_csv("items.csv", index=False)

# =========================
# STOCK
# =========================

# Creamos clave para item
df["item_key"] = (
    df["nombre"] + "|" +
    df["marca"] + "|" +
    df["modelo"] + "|" +
    df["tipo"]
)

# Agrupar stock
stock = df.groupby(["codigo_contenedor", "item_key"]).agg({
    "cantidad": "sum"
}).reset_index()

stock.to_csv("stock.csv", index=False)

print("✅ Archivos generados:")
print("- contenedores.csv")
print("- items.csv")
print("- stock.csv")