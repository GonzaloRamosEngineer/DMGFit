import React from 'react';
import { Helmet } from 'react-helmet';
import ExerciseBrowser from './components/ExerciseBrowser';

const ExerciseLibrary = () => (
  <>
    <Helmet>
      <title>Biblioteca de Ejercicios | VC Fit</title>
    </Helmet>

    <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-2 md:px-8">
      <ExerciseBrowser
        title="Biblioteca de ejercicios"
        subtitle="Catálogo con animación e instrucciones paso a paso para armar rutinas, asignar sesiones y enseñar la técnica."
      />
    </div>
  </>
);

export default ExerciseLibrary;
