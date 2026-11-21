DOCTOR_OK=0
DOCTOR_WARN=0
DOCTOR_FAIL=0

doctor_report() {
  printf '%-5s %-22s %s\n' "$1" "$2" "$3"
}

doctor_ok() {
  DOCTOR_OK=$((DOCTOR_OK + 1))
  doctor_report ok "$1" "${2:-}"
}

doctor_warn() {
  DOCTOR_WARN=$((DOCTOR_WARN + 1))
  doctor_report warn "$1" "${2:-}"
}

doctor_fail() {
  DOCTOR_FAIL=$((DOCTOR_FAIL + 1))
  doctor_report FAIL "$1" "${2:-}"
}

doctor_step() {
  if step_skipped "$1"; then
    doctor_report skip "$1" "(INSTALL_SKIP)"
    return 0
  fi
  "$2"
}

doctor_summary() {
  echo
  echo "doctor: $DOCTOR_OK ok, $DOCTOR_WARN warnings, $DOCTOR_FAIL failed"
  [ "$DOCTOR_FAIL" -eq 0 ]
}
