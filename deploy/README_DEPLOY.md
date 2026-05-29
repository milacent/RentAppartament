Краткая инструкция по деплою на сервер (Ubuntu/Debian)

Предусловия
- Сервер с публичным IP
- В DNS прописан A-запись для домена example.com → IP сервера
- Установлены: Docker Engine, Docker Compose v2
- Порты 80 и 443 открыты в firewall

Шаги (на сервере, в директории проекта)

1) Клонировать репозиторий и перейти в каталог проекта:

   git clone <repo> .
   cd RentAppartament

2) Подготовить переменные окружения и дать права на скрипт:

   export DOMAIN=example.com
   export EMAIL=you@example.com
   chmod +x deploy/deploy.sh

3) Запустить скрипт деплоя (он запустит nginx в режиме ожидания, получит сертификаты и поднимет все сервисы):

   DOMAIN=$DOMAIN EMAIL=$EMAIL ./deploy/deploy.sh

4) Проверить работу:

   curl -vk https://example.com/
   curl -vk https://example.com/api/health
   curl -vk https://example.com/metrics

Автоматическое продление сертификатов
- Добавьте cron задачу (пример):

  # ежесуточная попытка обновления в 3:00
  0 3 * * * cd /path/to/project && docker run --rm -v $(pwd)/nginx/letsencrypt:/var/www/certbot -v $(pwd)/nginx/ssl:/etc/letsencrypt certbot/certbot renew --webroot -w /var/www/certbot && docker compose exec nginx nginx -s reload

Примечания
- Скрипт предполагает, что `docker compose` доступен и настроен.
- Для production рекомендуется собрать статическую версию фронтенда и обслуживать её напрямую nginx (увеличит производительность). Я могу добавить шаг сборки и конфиг для static export, если нужно.
