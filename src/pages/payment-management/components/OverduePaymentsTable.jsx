import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const OverduePaymentsTable = ({ payments, onSendReminder, onScheduleCall, onCreatePlan, loading = false }) => {
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

  const filteredPayments = payments?.filter(payment =>
    payment?.athleteName?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
    payment?.athleteId?.toLowerCase()?.includes(searchTerm?.toLowerCase())
  );

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

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
              Pagos Vencidos
            </h3>
            <p className="text-sm text-muted-foreground">
              {filteredPayments?.length || 0} atletas con pagos pendientes
            </p>
          </div>
          {selectedPayments?.length > 0 && (
            <Button variant="default" size="sm" onClick={() => onSendReminder(selectedPayments)}>
              <Icon name="Bell" size={16} className="mr-2" />
              Enviar Recordatorios ({selectedPayments?.length})
            </Button>
          )}
        </div>

        <Input
          type="search"
          placeholder="Buscar por nombre o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e?.target?.value)}
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selectedPayments?.length === filteredPayments?.length && filteredPayments?.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border bg-input"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Atleta</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Monto</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Días Vencido</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contacto</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredPayments?.length > 0 ? (
              filteredPayments.map((payment) => (
                <tr key={payment?.id} className="hover:bg-muted/30 transition-smooth group">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedPayments?.includes(payment?.id)}
                      onChange={() => handleSelectPayment(payment?.id)}
                      className="w-4 h-4 rounded border-border bg-input"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {payment?.athleteImage ? (
                        <Image
                          src={payment.athleteImage}
                          alt={payment.athleteName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon name="User" size={16} className="text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{payment?.athleteName}</p>
                        <p className="text-xs text-muted-foreground font-data">ID: {payment?.athleteId?.slice(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-base font-data font-semibold text-foreground">${payment?.amountOwed?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{payment?.invoiceCount || 1} facturas</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(payment?.daysOverdue)}`}>
                      <Icon name="Clock" size={14} className="mr-1" />
                      {payment?.daysOverdue} días
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-foreground">{payment?.lastContact || 'Nunca'}</p>
                    <p className="text-xs text-muted-foreground">{payment?.contactMethod || '-'}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => onSendReminder([payment?.id])} title="Recordar">
                        <Icon name="Bell" size={16} />
                      </Button>
                      <QuickActionMenu entityId={payment?.id} entityType="payment" />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="py-12 text-center text-muted-foreground">
                  <Icon name="CheckCircle" size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No se encontraron pagos vencidos.</p>
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