#!/bin/sh
set -eu

LABEL_SELECTOR="${WATCHDOG_LABEL:-com.techsphere.watchdog=true}"
INTERVAL_SECONDS="${WATCHDOG_INTERVAL_SECONDS:-30}"
WINDOW_SECONDS="${WATCHDOG_WINDOW_SECONDS:-1800}"
MAX_RESTARTS="${WATCHDOG_MAX_RESTARTS:-3}"
STATE_DIR="${WATCHDOG_STATE_DIR:-/state}"

mkdir -p "$STATE_DIR"

sanitize_name() {
  echo "$1" | tr -c 'A-Za-z0-9_.-' '_'
}

prune_timestamps() {
  now="$1"
  timestamps="$2"
  kept=""
  for ts in $timestamps; do
    age=$((now - ts))
    if [ "$age" -le "$WINDOW_SECONDS" ]; then
      kept="$kept $ts"
    fi
  done
  echo "$kept" | xargs
}

count_words() {
  if [ -z "${1:-}" ]; then
    echo 0
  else
    set -- $1
    echo "$#"
  fi
}

record_restart_attempt() {
  now="$1"
  timestamps="$2"
  echo "$(prune_timestamps "$now" "$timestamps") $now" | xargs
}

while true; do
  now="$(date +%s)"

  docker ps -a --filter "label=$LABEL_SELECTOR" --format '{{.ID}}' | while read -r id; do
    [ -n "$id" ] || continue

    name="$(docker inspect --format '{{.Name}}' "$id" | sed 's#^/##')"
    state="$(docker inspect --format '{{.State.Status}}' "$id")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
    restart_count="$(docker inspect --format '{{.RestartCount}}' "$id")"
    state_file="$STATE_DIR/$(sanitize_name "$name").state"

    last_restart_count="0"
    timestamps=""
    state_loaded="false"
    if [ -f "$state_file" ]; then
      # shellcheck disable=SC1090
      . "$state_file" || true
      state_loaded="true"
    fi

    timestamps="$(prune_timestamps "$now" "$timestamps")"
    if [ "$state_loaded" = "true" ] && [ "$restart_count" -gt "$last_restart_count" ]; then
      delta=$((restart_count - last_restart_count))
      i=0
      while [ "$i" -lt "$delta" ]; do
        timestamps="$(record_restart_attempt "$now" "$timestamps")"
        i=$((i + 1))
      done
    fi

    attempts="$(count_words "$timestamps")"
    needs_restart="false"

    if [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
      needs_restart="true"
    fi

    if [ "$state" = "running" ] && [ "$health" = "unhealthy" ]; then
      needs_restart="true"
    fi

    if [ "$needs_restart" = "true" ]; then
      if [ "$attempts" -ge "$MAX_RESTARTS" ]; then
        echo "[$(date -Iseconds)] $name is $state/$health and reached $attempts restarts in ${WINDOW_SECONDS}s. Disabling restart policy and stopping it."
        docker update --restart=no "$id" >/dev/null 2>&1 || true
        docker stop "$id" >/dev/null 2>&1 || true
      else
        timestamps="$(record_restart_attempt "$now" "$timestamps")"
        echo "[$(date -Iseconds)] Restarting $name ($state/$health). Attempt $(count_words "$timestamps")/$MAX_RESTARTS in ${WINDOW_SECONDS}s."
        if [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
          docker start "$id" >/dev/null 2>&1 || true
        else
          docker restart "$id" >/dev/null 2>&1 || true
        fi
        restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || echo "$restart_count")"
      fi
    fi

    cat > "$state_file" <<EOF
last_restart_count="$restart_count"
timestamps="$timestamps"
EOF
  done

  sleep "$INTERVAL_SECONDS"
done
