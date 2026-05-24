import psycopg2
import subprocess
import sys
import os

def run():
    print("=== ORCHESTRATING PRODUCTION SMOKE TEST ===")
    conn = psycopg2.connect(
        host='aws-1-sa-east-1.pooler.supabase.com',
        port=6543,
        dbname='postgres',
        user='postgres.extrlcvcgypwazxipvqm',
        password='IJoFJbT8Qj0Q0w5m'
    )
    cur = conn.cursor()

    try:
        # 1. Setup DB state
        print("Temporarily associating PP 1 to IC 1...")
        cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = 1 WHERE id = 1")
        conn.commit()

        # 2. Run Playwright production smoke test
        print("Launching Playwright production smoke test script...")
        res = subprocess.run(["node", "scripts/run_smoke_tests_playwright.js"], capture_output=True, text=True)
        print("=== PLAYWRIGHT OUTPUT ===")
        print(res.stdout)
        if res.stderr:
            print("=== PLAYWRIGHT ERRORS ===")
            print(res.stderr)

        if res.returncode != 0:
            print(f"Playwright test failed with return code {res.returncode}")
            sys.exit(1)
        else:
            print("Playwright test completed successfully!")

    finally:
        # 3. Clean up DB state
        print("Restoring PP 1 association to NULL...")
        cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = NULL WHERE id = 1")
        conn.commit()
        conn.close()

if __name__ == "__main__":
    run()
