import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../AppIcon';

// Modo automático (legacy): arma las migas a partir de la URL actual.
const generateFromPath = (currentPath, entityData) => {
  const pathSegments = currentPath?.split('/')?.filter(Boolean);
  const breadcrumbs = [
    { label: 'Dashboard', path: '/main-dashboard', icon: 'Home' }
  ];

  if (pathSegments?.includes('athletes-management')) {
    breadcrumbs?.push({ label: 'Atletas', path: '/athletes-management', icon: 'Users' });
  }

  if (pathSegments?.includes('individual-athlete-profile') && entityData?.athleteName) {
    breadcrumbs?.push({
      label: entityData?.athleteName,
      path: `/individual-athlete-profile/${entityData?.athleteId}`,
      icon: 'User',
      active: true,
    });
  }

  if (pathSegments?.includes('payment-management')) {
    breadcrumbs?.push({ label: 'Pagos', path: '/payment-management', icon: 'CreditCard', active: true });
  }

  return breadcrumbs;
};

// Migas de navegación. Acepta `items` explícito (API preferida) o, si no,
// las deriva de `currentPath` (modo legacy). El primer item enlazable actúa
// como botón "volver" (lleva flecha ←).
const BreadcrumbTrail = ({ currentPath = '', entityData = {}, items = null }) => {
  const crumbs = Array.isArray(items) && items.length > 0
    ? items
    : generateFromPath(currentPath, entityData);

  if (!crumbs || crumbs.length <= 1) return null;

  // El primer item que no sea el actual y tenga path navegable = affordance de "volver".
  const backIndex = crumbs.findIndex((c) => !c.active && c.path && c.path !== '#');

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isActive = crumb?.active || index === crumbs.length - 1;
          const isBack = index === backIndex;
          const navigable = !isActive && crumb?.path && crumb?.path !== '#';

          return (
            <li key={`${crumb?.path || crumb?.label}-${index}`} className="flex items-center gap-x-1.5 min-w-0">
              {index > 0 && (
                <Icon name="ChevronRight" size={15} className="shrink-0 text-text-tertiary" />
              )}

              {navigable ? (
                <Link
                  to={crumb.path}
                  className={
                    isBack
                      ? 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 font-bold text-primary transition-colors hover:bg-info-light'
                      : 'inline-flex items-center gap-1.5 text-text-secondary transition-colors hover:text-primary'
                  }
                >
                  {isBack && <Icon name="ArrowLeft" size={16} className="shrink-0" />}
                  {crumb.icon && !isBack && <Icon name={crumb.icon} size={15} className="shrink-0" />}
                  <span className="truncate max-w-[160px] sm:max-w-none">{crumb.label}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-text-primary min-w-0">
                  {crumb.icon && <Icon name={crumb.icon} size={15} className="shrink-0 text-primary" />}
                  <span className="truncate max-w-[180px] sm:max-w-none">{crumb.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadcrumbTrail;
