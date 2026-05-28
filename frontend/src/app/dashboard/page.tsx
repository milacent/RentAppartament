'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { predictionsAPI } from '@/services/api';
import { Prediction } from '@/types';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { token, initializeAuth, logout } = useAuthStore();
  const router = useRouter();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    region: string;
    address: string;
    district: string;
    square: string;
    floor: string;
    max_floor: string;
    metro: string;
    rooms: string;
    time: string;
    time_type: string;
    description: string;
  }>({
    region: 'Москва и МО',
    address: 'Москва, ЦАО, р-н Басманный, ул. Маросейка, 10/1С4',
    district: 'Басманный',
    square: '50',
    floor: '2',
    max_floor: '5',
    metro: 'Китай-город',
    rooms: '2',
    time: '4',
    time_type: 'walk',
    description: 'Заселение в квартиру возможно с 1.07.  Показы возможны сейчас. \n\nПредставляем вашему вниманию уютную двухкомнатную квартиру в историческом центре Москвы, расположенную на Китай-Городе.\nЭтот вариант прекрасно подойдет тем, кто мечтает жить в сердце столицы, наслаждаясь всеми преимуществами городской инфраструктуры и удобством расположения. \nПреимущества проживания: кирпичный дом, обеспечивающий тепло зимой и прохладу летом. Комфортное пространство: гостиная и спальня спланированы таким образом, чтобы обеспечить максимальное удобство для семьи или пары друзей. \nРемонт: качественная отделка в стиле евростандарта. Ламинат и керамическая плитка на полу создают ощущение тепла и элегантности. Стены украшают светлые тона обоев, создающие атмосферу гармонии и покоя.\nОсобые удобства: санузел оснащен душевой кабинкой и отделан качественной плиткой. Это создает дополнительное чувство комфорта и уюта. \nИнтерьер: кухонный гарнитур итальянского производства гармонично дополняют обеденная группа, удобные диваны и качественный спальный гарнитур. \nМебель встроенного типа помогает оптимально организовать пространство. \nСовременные технологии: телевизор, холодильник, стиральная машина, кондиционер обеспечивают высокий уровень комфорта в повседневной жизни. \nНаличие домофона добавляет дополнительный элемент безопасности. \nТранспортная доступность: метро находится всего в нескольких минутах ходьбы, что значительно упрощает передвижение по городу. \nЭта квартира сочетает в себе европейский стандарт качества ремонта и удобную инфраструктуру района, предлагая своим жильцам жизнь в самом центре Москвы с возможностью быстро добраться до всех значимых мест города. \nЕсли вы мечтаете о комфортной квартире с качественным ремонтом и развитой инфраструктурой, расположенной рядом с метро, тогда эта квартира ждет вас! \nСвяжитесь с нами для подробной консультации и возможности ознакомиться с квартирой лично.\n\nАрт. 28618515',
  });


  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }

    loadPredictions();
  }, [token, router]);

  const loadPredictions = async () => {
    try {
      const { data } = await predictionsAPI.list(0, 20);
      setPredictions(data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        router.push('/auth/login');
        return;
      }
      toast.error(err.response?.data?.detail || 'Не удалось загрузить прогнозы');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const square = parseFloat(formData.square);
    const floor = parseInt(formData.floor, 10);
    const max_floor = parseInt(formData.max_floor, 10);
    const rooms = parseInt(formData.rooms, 10);
    const time = parseInt(formData.time, 10);

    if (Number.isNaN(square) || square < 10) {
      setFormError('Площадь должна быть не менее 10 м²');
      return;
    }
    if (square > 700) {
      setFormError('Площадь не может быть больше 700 м²');
      return;
    }
    if (Number.isNaN(floor) || floor < 1) {
      setFormError('Этаж должен быть не меньше 1');
      return;
    }
    if (floor > 100) {
      setFormError('Этаж не может быть больше 100');
      return;
    }
    if (Number.isNaN(max_floor) || max_floor < 1) {
      setFormError('Максимальный этаж должен быть не меньше 1');
      return;
    }
    if (max_floor > 120) {
      setFormError('Максимальный этаж не может быть больше 120');
      return;
    }
    if (floor > max_floor) {
      setFormError('Этаж не может быть больше максимального этажа');
      return;
    }
    if (Number.isNaN(rooms) || rooms < 1) {
      setFormError('Количество комнат должно быть не менее 1');
      return;
    }
    if (rooms > 10) {
      setFormError('Количество комнат не может быть больше 10');
      return;
    }
    if (Number.isNaN(time) || time < 0) {
      setFormError('Время до метро должно быть неотрицательным');
      return;
    }
    if (time > 120) {
      setFormError('Время до метро не может быть больше 120 минут');
      return;
    }
    if (rooms * 8 > square + 20) {
      setFormError('Для заданной площади слишком много комнат');
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
      const payload = {
        title: formData.address,
        region: formData.region,
        address: formData.address,
        square,
        floor,
        max_floor,
        metro: formData.metro,
        rooms: formData.rooms,
        time,
        time_type: formData.time_type,
        description: formData.description,
      };

      console.log('Sending payload:', payload);
      console.log('Data types:', {
        square: typeof payload.square,
        floor: typeof payload.floor,
        max_floor: typeof payload.max_floor,
        time: typeof payload.time,
        rooms: typeof payload.rooms,
      });
      const { data } = await predictionsAPI.create(payload);
      
      const price = (data as any)?.predicted_price ?? (data as any)?.prediction ?? (data as any)?.price;
      if (price) {
        console.log('Prediction response:', data);
        console.log('Predicted price:', price, typeof price);
        toast.success(`✅ Прогноз создан! Цена: ₽${Math.round(price).toLocaleString('ru-RU')}`);
      }
      
      await loadPredictions();
      // keep current formData so user inputs remain in the form after prediction
    } catch (err: any) {
      const detail = err.response?.data?.detail || err?.message || 'Ошибка при создании прогноза';
      console.error('Prediction error response:', err.response?.data);
      console.error('Error:', err.message);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030d] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-60px] h-72 w-72 -translate-x-1/2 rounded-full bg-[#3b82f6]/12 blur-3xl" />
        <div className="absolute right-[-100px] top-36 h-96 w-96 rounded-full bg-[#8b5cf6]/12 blur-3xl" />
        <div className="absolute left-[-120px] bottom-0 h-[420px] w-[420px] rounded-full bg-[#0ea5e9]/12 blur-3xl" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSubmit} className="glass-card rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold mb-6">📝 Enter property details</h2>
              {formError ? (
                <div className="rounded-lg border border-red-500 bg-red-950/40 px-4 py-2 text-sm text-red-300">
                  {formError}
                </div>
              ) : null}

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Регион</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Москва и МО"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Адрес</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Москва, ул. Примерная, 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Area (m²)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.square}
                    onChange={(e) => setFormData({...formData, square: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Rooms</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.rooms}
                    onChange={(e) => setFormData({...formData, rooms: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Этаж</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.floor}
                    onChange={(e) => setFormData({...formData, floor: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Макс этажей</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.max_floor}
                    onChange={(e) => setFormData({...formData, max_floor: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Метро</label>
                <input
                  type="text"
                  value={formData.metro}
                  onChange={(e) => setFormData({...formData, metro: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Китай-город"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">До метро (мин)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Тип пути</label>
                  <select
                    value={formData.time_type}
                    onChange={(e) => setFormData({...formData, time_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="walk">Пешком</option>
                    <option value="transport">Транспорт</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#a78bfa] disabled:opacity-60 text-white font-bold py-2 rounded transition mt-6"
              >
                {loading ? '⏳ Loading...' : '✨ Get estimate'}
              </button>
            </form>
          </div>

          {/* Predictions List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">📊 Your predictions</h2>
              {predictions.length === 0 ? (
                <div className="glass-card rounded-lg p-6 text-center text-slate-300">
                  No predictions yet. Fill the form on the left.
                </div>
              ) : (
                predictions.map((pred) => (
                  <div key={pred.id} className="glass-card rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{pred.title}</h3>
                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Moscow_Metro.svg/3840px-Moscow_Metro.svg.png"
                            alt="Metro"
                            className="w-4 h-4 object-contain shrink-0"
                          />
                          <p>{pred.metro}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400">
                          ₽{Math.round(pred.predicted_price || 0).toLocaleString('ru-RU')}
                        </div>
                        <p className="text-slate-300 text-sm">rental price</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-slate-300">
                      <div>📐 {pred.square} m²</div>
                      <div>🛏️ {pred.rooms_clean} rooms</div>
                      <div>📍 {pred.floor}/{pred.max_floor} floor</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
