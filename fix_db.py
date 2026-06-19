import sqlite3

# 连接到你的本地数据库
conn = sqlite3.connect('inventory.db')
# 删掉旧的草稿表
conn.execute("DROP TABLE IF EXISTS user")
conn.commit()
conn.close()

print("✅ 旧的草稿表已成功删除！现在请去重启 FastAPI。")