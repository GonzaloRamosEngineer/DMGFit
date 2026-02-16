import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const OverduePaymentsTable = ({ 
  payments, 
  onSendReminder, 
  loading = false, 
  mode = 'overdue' // 'overdue' | 'all'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayments, setSelectedPayments] = useState([]);

  // Skeleton Loader
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
        <div className="p-4 border-b border-border flex justify-between">
          <div className="h-6 bg-muted/50 rounded w-1/3"></div>
          <div className="h-8 bg-muted/50 rounded w-1/4"></div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4">
              <div className="h-10 w-10 bg-muted/50 rounded-full"></div>
              <div className="h-4 bg-muted/50 rounded w-full mt-3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filtrado simple por nombre
  const filteredPayments = payments?.filter(payment => {
    // Intentamos buscar por nombre del atleta, o si no existe, por concepto
    const searchString = searchTerm.toLowerCase();
    const nameMatch = payment?.athleteName?.toLowerCase()?.includes(searchString);
    const conceptMatch = payment?.concept?.toLowerCase()?.includes(searchString);
    return nameMatch || conceptMatch;
  });

  const handleSelectAll = (e) => {
    if (e?.target?.checked) {
      setSelectedPayments(filteredPayments?.map(p => p?.id));
    } else {
      setSelectedPayments([]);
    }
  };

  const handleSelectPayment = (paymentId) => {
    setSelectedPayments(prev =>
      prev?.includes(paymentId)
        ? prev?.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const getSeverityColor = (days) => {
    if (days >= 30) return 'text-error bg-error/10';
    if (days >= 15) return 'text-warning bg-warning/10';
    return 'text-muted-foreground bg-muted';
  };

  // Helper para renderizar estado (Badge)
  const renderStatusBadge = (status, date) => {
    if (status === 'paid') return <span className="px-2 py-1 rounded-full text-xs font-bold bg-success/10 text-success">Pagado</span>;
    if (status === 'overdue') return <span className="px-2 py-1 rounded-full text-xs font-bold bg-error/10 text-error">Vencido</span>;
    return <span className="px-2 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning">Pendiente</span>;
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
              {mode === 'overdue' ? 'Pagos Vencidos' : 'Listado de Pagos'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filteredPayments?.length || 0} registros encontrados
            </p>
          </div>
          
          {/* Solo mostramos acciones masivas si es modo Vencidos */}
          {mode === 'overdue' && selectedPayments?.length > 0 && (
            <Button variant="default" size="sm" onClick={() => onSendReminder(selectedPayments)}>
              <Icon name="Bell" size={16} className="mr-2" />
              Enviar Recordatorios ({selectedPayments?.length})
            </Button>
          )}
        </div>

        <Input
          type="search"
          placeholder={mode === 'overdue' ? "Buscar deudor..." : "Buscar por nombre o concepto..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e?.target?.value)}
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm text-left">
          <thead className="bg-muted/50 uppercase text-xs font-medium text-muted-foreground">
            <tr>
              {/* Checkbox solo en modo Vencidos para acciones masivas */}
              {mode === 'overdue' && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedPayments?.length === filteredPayments?.length && filteredPayments?.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border bg-input"
                  />
                </th>
              )}

              {/* COLUMNA: FECHA (Solo en modo general) */}
              {mode === 'all' && <th className="px-4 py-3">Fecha</th>}

              <th className="px-4 py-3">Atleta</th>
              
              {/* COLUMNA: CONCEPTO (Solo en modo general) */}
              {mode === 'all' && <th className="px-4 py-3">Concepto</th>}

              <th className="px-4 py-3">Monto</th>

              {/* COLUMNAS VARIABLES */}
              {mode === 'overdue' ? (
                <>
                  <th className="px-4 py-3">Días Vencido</th>
                  <th className="px-4 py-3">Contacto</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </>
              )}

              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredPayments?.length > 0 ? (
              filteredPayments.map((payment) => (
                <tr key={payment?.id} className="hover:bg-muted/30 transition-smooth group">
                  
                  {/* Checkbox */}
                  {mode === 'overdue' && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPayments?.includes(payment?.id)}
                        onChange={() => handleSelectPayment(payment?.id)}
                        className="w-4 h-4 rounded border-border bg-input"
                      />
                    </td>
                  )}

                  {/* Fecha (Solo All) */}
                  {mode === 'all' && (
                    <td className="px-4 py-4 whitespace-nowrap text-foreground">
                      {payment.payment_date 
                        ? new Date(payment.payment_date).toLocaleDateString() 
                        : '-'}
                    </td>
                  )}

                  {/* Atleta */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {payment?.athleteImage ? (
                        <Image
                          src={payment.athleteImage}
                          alt={payment.athleteName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                             {payment?.athleteName?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{payment?.athleteName || 'Desconocido'}</p>
                        {mode === 'overdue' && (
                          <p className="text-xs text-muted-foreground font-data">ID: {payment?.athleteId?.slice(0,6)}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Concepto (Solo All) */}
                  {mode === 'all' && (
                    <td className="px-4 py-4 text-muted-foreground max-w-[200px] truncate" title={payment.concept}>
                      {payment.concept || '-'}
                    </td>
                  )}

                  {/* Monto */}
                  <td className="px-4 py-4 font-mono font-medium text-foreground">
                    ${(payment?.amountOwed || payment?.amount || 0).toLocaleString()}
                  </td>

                  {/* Variables */}
                  {mode === 'overdue' ? (
                    <>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(payment?.daysOverdue)}`}>
                          <Icon name="Clock" size={12} className="mr-1" />
                          {payment?.daysOverdue} días
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {payment?.lastContact || '-'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 capitalize text-foreground">{payment?.method || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        {renderStatusBadge(payment?.status, payment?.payment_date)}
                      </td>
                    </>
                  )}

                  {/* Acciones */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {mode === 'overdue' && (
                        <Button variant="outline" size="sm" onClick={() => onSendReminder([payment?.id])} title="Recordar">
                          <Icon name="Bell" size={16} />
                        </Button>
                      )}
                      {/* Aquí podrías agregar un botón de ver detalle o editar */}
                      <QuickActionMenu entityId={payment?.id} entityType="payment" />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="py-12 text-center text-muted-foreground">
                  <Icon name="CheckCircle" size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No se encontraron registros.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverduePaymentsTable;