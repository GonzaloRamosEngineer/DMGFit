import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

const AccessHistory = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Traemos el log + datos del atleta + perfil
      const { data, error } = await supabase
        .from('access_logs')
        .select(`
          id, check_in_time, access_granted, rejection_reason,
          athletes (
            id, 
            profiles (full_name, email)
          )
        `)
        // Filtramos por el día seleccionado (desde las 00:00 a las 23:59)
        .gte('check_in_time', `${filterDate}T00:00:00`)
        .lte('check_in_time', `${filterDate}T23:59:59`)
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterDate]);

  return (
    <>
      <Helmet>
        <title>Historial de Accesos - DigitalMatch</title>
      </Helmet>
      
      {/* REMOVED NavigationSidebar - ya está en AppLayout */}
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail 
            items={[
              { label: 'Historial de Accesos', path: '/access-history', active: true }
            ]} 
          />
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                Historial de Accesos
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Registro de ingresos por molinete
              </p>
            </div>
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-4 font-medium text-muted-foreground">Hora</th>
                    <th className="p-4 font-medium text-muted-foreground">Atleta</th>
                    <th className="p-4 font-medium text-muted-foreground">Estado</th>
                    <th className="p-4 font-medium text-muted-foreground">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Icon name="Loader" size={20} className="animate-spin" />
                          Cargando...
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-muted-foreground">
                        <Icon name="Info" size={24} className="mx-auto mb-2 opacity-50" />
                        Sin registros para este día
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-mono text-foreground">
                          {new Date(log.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="p-4 font-medium text-foreground">
                          {log.athletes?.profiles?.full_name || 'Desconocido'}
                        </td>
                        <td className="p-4">
                          {log.access_granted ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-success/10 text-success">
                              <Icon name="Check" size={12} className="mr-1" /> Permitido
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-error/10 text-error">
                              <Icon name="X" size={12} className="mr-1" /> Denegado
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-muted-foreground italic">
                          {log.rejection_reason || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Estadísticas del día */}
          {!loading && logs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="Users" size={20} color="var(--color-primary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{logs.length}</p>
                    <p className="text-sm text-muted-foreground">Total de Registros</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="Check" size={20} color="var(--color-success)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">
                      {logs.filter(l => l.access_granted).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Accesos Permitidos</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-error/10 rounded-lg flex items-center justify-center">
                    <Icon name="X" size={20} color="var(--color-error)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">
                      {logs.filter(l => !l.access_granted).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Accesos Denegados</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AccessHistory;