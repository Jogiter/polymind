#!/usr/bin/env bash
# ============================================================================
# PolyMind PostgreSQL 备份脚本
# - pg_dump 导出为带时间戳的 gzip 压缩文件
# - 保留 7 天，自动清理过期备份
# - cron 友好（set -euo pipefail）
#
# 用法（宿主机直连 PG）：
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup.sh
# 或显式 PG* 变量：
#   PGHOST=localhost PGUSER=user PGPASSWORD=*** PGDATABASE=aichat ./scripts/backup.sh
#
# 通过 docker compose 在 db 容器内执行（推荐自托管场景）：
#   docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
#     | gzip > backups/polymind_$(date +%F_%H%M%S).sql.gz
#
# cron 示例（每日 03:00，UTC）：
#   0 3 * * * cd /opt/polymind && ./scripts/backup.sh >> /var/log/polymind-backup.log 2>&1
# ============================================================================

set -euo pipefail

# ---- 配置 ----
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"   # UTC 时间戳，统一时区
OUTFILE="${BACKUP_DIR}/polymind_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] 开始备份 -> ${OUTFILE}"

# ---- 执行 pg_dump ----
# 优先使用 DATABASE_URL（pg_dump 直接接受连接串），否则依赖 PG* 环境变量
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --no-owner --no-privileges "${DATABASE_URL}" | gzip > "${OUTFILE}"
else
  # 依赖 PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE
  pg_dump --no-owner --no-privileges | gzip > "${OUTFILE}"
fi

# 校验产物非空
if [ ! -s "${OUTFILE}" ]; then
  echo "[$(date -u +%FT%TZ)] 错误：备份文件为空，删除并退出" >&2
  rm -f "${OUTFILE}"
  exit 1
fi

echo "[$(date -u +%FT%TZ)] 备份完成：$(du -h "${OUTFILE}" | cut -f1)"

# ---- 清理过期备份（保留 RETENTION_DAYS 天）----
echo "[$(date -u +%FT%TZ)] 清理 ${RETENTION_DAYS} 天前的备份..."
find "${BACKUP_DIR}" -name 'polymind_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] 完成。当前备份列表："
ls -lh "${BACKUP_DIR}"/polymind_*.sql.gz 2>/dev/null || echo "（无）"
