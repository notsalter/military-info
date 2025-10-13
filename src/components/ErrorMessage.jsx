import React from 'react';

const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <h3 className="text-red-800 font-bold text-lg mb-2">Terjadi Kesalahan</h3>
      <p className="text-red-600 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-200"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
