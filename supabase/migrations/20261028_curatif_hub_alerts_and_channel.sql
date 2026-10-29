-- =============================================================================
-- Migration Curative : Moteur d'Alertes Automatiques & Canal Descendant (Lot H)
-- =============================================================================

-- 1. Fonction d'extraction métrique pour l'évaluation des règles d'alerte
create or replace function public.hub_metric_value(p_metric text, p_tenant_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_val numeric := 0;
begin
  case p_metric
    when 'sync_errors_count' then
      -- Nombre d'erreurs de synchronisation dans les dernières 24 heures
      select coalesce(sum(error_count), 0) into v_val
      from public.sync_runs
      where tenant_id = p_tenant_id
        and created_at >= now() - interval '24 hours';

    when 'days_since_last_sync' then
      -- Nombre de jours depuis la dernière synchronisation réussie d'un poste
      select coalesce(extract(day from (now() - max(last_sync_at))), 0) into v_val
      from public.sync_devices
      where tenant_id = p_tenant_id;

    when 'days_before_expiry' then
      -- Jours restants avant expiration de l'abonnement du tenant
      select coalesce(extract(day from (expires_at - now())), 9999) into v_val
      from public.tenants
      where id = p_tenant_id;

    else
      -- Repli sur les KPIs journaliers agrégés les plus récents
      select coalesce(sync_errors_count, 0) into v_val
      from public.kpi_tenant_daily
      where tenant_id = p_tenant_id
      order by metric_date desc
      limit 1;
  end case;

  return coalesce(v_val, 0);
end;
$$;

-- 2. Procédure d'évaluation des alertes (Dédoublonnage + Résolution automatique)
create or replace function public.hub_evaluate_alerts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant record;
  v_rule record;
  v_val numeric;
  v_triggered boolean;
  v_open_alert record;
  v_alerts_created int := 0;
  v_alerts_resolved int := 0;
begin
  for v_tenant in select id, name from public.tenants loop
    for v_rule in select * from public.alert_rules where is_active = true loop
      v_val := public.hub_metric_value(v_rule.metric_name, v_tenant.id);

      -- Évaluation de la condition selon l'opérateur
      v_triggered := case
        when v_rule.operator = 'gt'  then v_val >  v_rule.threshold
        when v_rule.operator = 'gte' then v_val >= v_rule.threshold
        when v_rule.operator = 'lt'  then v_val <  v_rule.threshold
        when v_rule.operator = 'lte' then v_val <= v_rule.threshold
        when v_rule.operator = 'eq'  then v_val =  v_rule.threshold
        else false
      end;

      -- Recherche d'une alerte déjà ouverte pour cette règle et ce tenant
      select * into v_open_alert
      from public.alerts
      where tenant_id = v_tenant.id
        and rule_id = v_rule.id
        and status = 'open'
      limit 1;

      if v_triggered then
        -- Dédoublonnage : on ne crée l'alerte que si aucune n'est déjà ouverte
        if v_open_alert.id is null then
          insert into public.alerts (
            tenant_id,
            rule_id,
            title,
            message,
            severity,
            status,
            metadata
          ) values (
            v_tenant.id,
            v_rule.id,
            v_rule.name,
            format('Alerte déclenchée pour %s : %s (valeur: %s, seuil: %s %s)', v_tenant.name, v_rule.name, v_val, v_rule.operator, v_rule.threshold),
            v_rule.severity,
            'open',
            jsonb_build_object(
              'metric_name', v_rule.metric_name,
              'current_value', v_val,
              'threshold', v_rule.threshold,
              'operator', v_rule.operator,
              'triggered_at', now()
            )
          );
          v_alerts_created := v_alerts_created + 1;
        end if;
      else
        -- Auto-résolution : la métrique est revenue sous le seuil critique
        if v_open_alert.id is not null then
          update public.alerts
          set status = 'resolved',
              resolved_at = now(),
              metadata = metadata || jsonb_build_object('auto_resolved_at', now(), 'resolved_value', v_val)
          where id = v_open_alert.id;
          v_alerts_resolved := v_alerts_resolved + 1;
        end if;
      end if;
    end loop;
  end loop;

  return v_alerts_created;
end;
$$;

revoke all on function public.hub_metric_value from public;
grant execute on function public.hub_metric_value to authenticated;

revoke all on function public.hub_evaluate_alerts from public;
grant execute on function public.hub_evaluate_alerts to authenticated;
