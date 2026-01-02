interface Props {
  onClose: () => void;
}

export default function VoiceMemoGuide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Del fra Voice Memos</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Åbn Voice Memos app</p>
              <p className="text-sm text-gray-500">Find den optagelse du vil uploade</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Tryk på de tre prikker</p>
              <p className="text-sm text-gray-500">Øverst til højre ved optagelsen</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Vælg "Del"</p>
              <p className="text-sm text-gray-500">I menuen der kommer frem</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              4
            </div>
            <div>
              <p className="font-medium text-gray-900">Vælg "Gem til Filer"</p>
              <p className="text-sm text-gray-500">Gem i "På min iPhone" eller iCloud</p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold text-sm">
              5
            </div>
            <div>
              <p className="font-medium text-gray-900">Vælg filen her</p>
              <p className="text-sm text-gray-500">Tryk på "Vælg lydfil" og find din optagelse</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500 text-center">
            Tip: Du kan også optage direkte her i browseren!
          </p>
        </div>

        <button
          onClick={onClose}
          className="btn btn-primary w-full"
        >
          Forstået
        </button>
      </div>
    </div>
  );
}
