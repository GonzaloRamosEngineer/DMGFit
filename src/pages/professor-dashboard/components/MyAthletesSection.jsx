import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const MyAthletesSection = ({ athletes }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAthletes = athletes?.filter((athlete) =>
    athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    athlete.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="relative">
        <Icon name="Search" size={20} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar atleta por nombre o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
        />
      </div>

      {filteredAthletes?.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAthletes.map((athlete) => (
            <div key={athlete.id} className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg flex flex-col sm:flex-row gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {athlete.avatar ? (
                  <img src={athlete.avatar} alt={athlete.name} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                    <Icon name="User" size={32} className="text-primary" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-heading font-semibold text-foreground truncate">{athlete.name}</h3>
                <p className="text-sm text-muted-foreground mb-3 truncate">{athlete.email}</p>
                
                {/* Status Badge */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  athlete.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  {athlete.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    iconName="FileText" 
                    onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)} // CORRECCIÓN AQUÍ
                  >
                    Perfil
                  </Button>
                  <Button variant="ghost" size="sm" iconName="MessageSquare">
                    Mensaje
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Icon name="Users" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
            {searchQuery ? 'No se encontraron resultados' : 'No tienes atletas asignados'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Intenta con otro término' : 'Cuando se te asignen atletas, aparecerán aquí.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MyAthletesSection;