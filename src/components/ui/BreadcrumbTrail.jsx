import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../AppIcon';

const BreadcrumbTrail = ({ currentPath = '', entityData = {} }) => {
  const generateBreadcrumbs = () => {
    const pathSegments = currentPath?.split('/')?.filter(Boolean);
    const breadcrumbs = [
      { label: 'Dashboard', path: '/main-dashboard', icon: 'Home' }
    ];

    if (pathSegments?.includes('athletes-management')) {
      breadcrumbs?.push({
        label: 'Atletas',
        path: '/athletes-management',
        icon: 'Users'
      });
    }

    if (pathSegments?.includes('individual-athlete-profile') && entityData?.athleteName) {
      breadcrumbs?.push({
        label: entityData?.athleteName,
        path: `/individual-athlete-profile/${entityData?.athleteId}`,
        icon: 'User',
        isCurrent: true
      });
    }

    if (pathSegments?.includes('performance-analytics')) {
      breadcrumbs?.push({
        label: 'Rendimiento',
        path: '/performance-analytics',
        icon: 'TrendingUp',
        isCurrent: !entityData?.athleteName
      });
    }

    if (pathSegments?.includes('payment-management')) {
      breadcrumbs?.push({
        label: 'Pagos',
        path: '/payment-management',
        icon: 'CreditCard',
        isCurrent: true
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs?.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm mb-6">
      {breadcrumbs?.map((crumb, index) => (
        <React.Fragment key={crumb?.path}>
          {index > 0 && (
            <Icon
              name="ChevronRight"
              size={16}
              color="var(--color-muted-foreground)"
              className="flex-shrink-0"
            />
          )}
          {crumb?.isCurrent ? (
            <span className="flex items-center text-foreground font-medium">
              <Icon
                name={crumb?.icon}
                size={16}
                color="var(--color-primary)"
                className="mr-2"
              />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {crumb?.label}
              </span>
            </span>
          ) : (
            <Link
              to={crumb?.path}
              className="flex items-center text-muted-foreground hover:text-primary transition-smooth"
            >
              <Icon
                name={crumb?.icon}
                size={16}
                color="currentColor"
                className="mr-2"
              />
              <span className="truncate max-w-[150px] sm:max-w-none">
                {crumb?.label}
              </span>
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbTrail;