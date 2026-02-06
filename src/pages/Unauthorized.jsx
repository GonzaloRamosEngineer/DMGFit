import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react'; // Si usas lucide-react, si no, usa un string/emoji

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <div className="text-red-500 mb-4 flex justify-center">
          <ShieldAlert size={64} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso No Autorizado</h1>
        <p className="text-gray-600 mb-6">
          Lo sentimos, no tienes los permisos necesarios para acceder a esta sección del sistema.
        </p>
        <Link 
          to="/" 
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;