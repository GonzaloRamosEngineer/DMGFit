import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
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
    <div className="flex min-h-screen bg-background">
      <NavigationSidebar userRole="admin" />
      <div className="flex-1 ml-20 lg:ml-60 p-8 transition-all">
        <Helmet><title>Historial de Accesos - DigitalMatch</title></Helmet>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold font-heading">Historial de Accesos</h1>
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-card border border-border p-2 rounded-lg"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
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
                <tr><td colSpan="4" className="p-8 text-center">Cargando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">Sin registros para este día</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20">
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
    </div>
  );
};

export default AccessHistory;