import sys
import pathlib
sys.path.insert(0, str(pathlib.Path('../ventas_por_mes_rimec-main').resolve()))
from core.database import get_dataframe
import pandas as pd

df = get_dataframe("SELECT color_nombre, color_hex FROM v_stock_rimec LIMIT 50")
print(df.to_string(index=False))
