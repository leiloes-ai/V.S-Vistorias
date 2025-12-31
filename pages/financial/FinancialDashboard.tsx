import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../../contexts/AppContext.tsx';
import { FinancialTransaction } from '../../types.ts';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon, ExclamationTriangleIcon } from '../../components/Icons.tsx';

// FIX: Cast Pie to `any` to bypass a TypeScript error on the 'activeIndex' prop.
const AnyPie = Pie as any;

type FilterPreset = 'thisMonth' | 'last30' | 'thisYear' | 'custom';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; colorClass: string; }> = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md flex items-start gap-4">
        <div className={`p-3 rounded-lg ${colorClass.replace('text-', 'bg-').replace('600', '100')} dark:${colorClass.replace('text-', 'bg-').replace('600', '900/50')}`}>
            <span className={colorClass}>{icon}</span>
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * props.midAngle);
    const cos = Math.cos(-RADIAN * props.midAngle);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 15) * cos;
    const my = cy + (outerRadius + 15) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 12;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
            <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 4} outerRadius={outerRadius + 6} fill={fill} />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill={props.theme === 'dark' ? '#a0aec0' : '#4a5568'} className="text-xs font-semibold">{payload.name}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={14} textAnchor={textAnchor} fill={props.theme === 'dark' ? '#cbd5e1' : '#1e293b'} className="text-sm font-bold">
                {`R$ ${new Intl.NumberFormat('pt-BR').format(value)}`}
            </text>
        </g>
    );
};


const FinancialDashboard: React.FC = () => {
    const { financials, theme } = useContext(AppContext);
    
    const [filterPreset, setFilterPreset] = useState<FilterPreset>('thisMonth');
    const [customDateRange, setCustomDateRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [activeIndex, setActiveIndex] = useState(0);
    const onPieEnter = useCallback((_: any, index: number) => { setActiveIndex(index); }, []);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setFilterPreset('custom');
    };

    const setPreset = (preset: FilterPreset) => {
        setFilterPreset(preset);
        const end = new Date();
        let start = new Date();
        if (preset === 'thisMonth') {
            start.setDate(1);
        } else if (preset === 'last30') {
            start.setDate(end.getDate() - 30);
        } else if (preset === 'thisYear') {
            start = new Date(end.getFullYear(), 0, 1);
        }
        setCustomDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const dashboardData = useMemo(() => {
        const startDate = new Date(customDateRange.start + 'T00:00:00');
        const endDate = new Date(customDateRange.end + 'T23:59:59');

        const realizedTransactions = financials.filter(t => {
            const isRealized = !t.isPayableOrReceivable || t.status === 'Paga';
            if (!isRealized) return false;
            const transactionDate = new Date((t.paymentDate || t.date) + 'T00:00:00');
            return transactionDate >= startDate && transactionDate <= endDate;
        });

        const revenue = realizedTransactions.filter(t => t.type === 'Receita').reduce((sum, t) => sum + t.amount, 0);
        const expense = realizedTransactions.filter(t => t.type === 'Despesa').reduce((sum, t) => sum + t.amount, 0);
        
        const totalReceivable = financials.filter(t => t.isPayableOrReceivable && t.type === 'Receita' && t.status !== 'Paga').reduce((sum, t) => sum + t.amount, 0);
        const totalPayable = financials.filter(t => t.isPayableOrReceivable && t.type === 'Despesa' && t.status !== 'Paga').reduce((sum, t) => sum + t.amount, 0);
        
        const cashFlowData = realizedTransactions.reduce((acc, t) => {
            const month = new Date((t.paymentDate || t.date) + 'T00:00:00').toLocaleDateString('pt-BR', { year: '2-digit', month: 'short' });
            if (!acc[month]) acc[month] = { month, Receita: 0, Despesa: 0 };
            if (t.type === 'Receita') acc[month].Receita += t.amount;
            else acc[month].Despesa += t.amount;
            return acc;
        }, {} as Record<string, { month: string; Receita: number; Despesa: number }>);

        const expenseData = realizedTransactions.filter(t => t.type === 'Despesa').reduce((acc, t) => {
            if (!acc[t.category]) acc[t.category] = { name: t.category, value: 0 };
            acc[t.category].value += t.amount;
            return acc;
        }, {} as Record<string, { name: string; value: number }>);
        
        const today = new Date(); today.setHours(0,0,0,0);
        const next7days = new Date(); next7days.setDate(today.getDate() + 7);
        const upcomingPayables = financials.filter(t => t.isPayableOrReceivable && t.type === 'Despesa' && t.status === 'Pendente' && new Date(t.dueDate!) >= today && new Date(t.dueDate!) <= next7days).sort((a,b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
        const overduePayables = financials.filter(t => t.isPayableOrReceivable && t.type === 'Despesa' && t.status === 'Pendente' && new Date(t.dueDate!) < today);
        const recentTransactions = [...realizedTransactions].sort((a,b) => new Date(b.paymentDate || b.date).getTime() - new Date(a.paymentDate || a.date).getTime()).slice(0, 5);

        return {
            kpis: { revenue, expense, balance: revenue - expense, totalReceivable, totalPayable },
            cashFlow: Object.values(cashFlowData),
            expenses: Object.values(expenseData).sort((a, b) => b.value - a.value),
            upcomingPayables,
            overduePayables,
            recentTransactions
        };
    }, [financials, customDateRange]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b', '#06b6d4', '#ec4899'];

    const renderEmptyState = () => (
        <div className="text-center py-10 bg-white dark:bg-gray-800/50 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Sem dados financeiros</h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Não há transações realizadas no período selecionado.</p>
        </div>
    );
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800/50 p-1 rounded-lg shadow-sm">
                    {[{id: 'thisMonth', label: 'Este Mês'}, {id: 'last30', label: 'Últimos 30 dias'}, {id: 'thisYear', label: 'Este Ano'}].map(p => (
                        <button key={p.id} onClick={() => setPreset(p.id as FilterPreset)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${filterPreset === p.id ? 'bg-primary-500 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p.label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <input type="date" name="start" value={customDateRange.start} onChange={handleDateChange} className="bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-gray-200 dark:color-scheme-dark" />
                    <span className="text-gray-500">a</span>
                    <input type="date" name="end" value={customDateRange.end} onChange={handleDateChange} className="bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-gray-200 dark:color-scheme-dark" />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="Faturamento" value={formatCurrency(dashboardData.kpis.revenue)} icon={<ArrowTrendingUpIcon/>} colorClass="text-green-600"/>
                <StatCard title="Custos" value={formatCurrency(dashboardData.kpis.expense)} icon={<ArrowTrendingDownIcon/>} colorClass="text-red-600"/>
                <StatCard title="Lucro/Prejuízo" value={formatCurrency(dashboardData.kpis.balance)} icon={<CurrencyDollarIcon/>} colorClass={dashboardData.kpis.balance >= 0 ? "text-blue-600" : "text-red-600"}/>
                <StatCard title="A Receber" value={formatCurrency(dashboardData.kpis.totalReceivable)} icon={<ArrowTrendingUpIcon/>} colorClass="text-amber-600"/>
                <StatCard title="A Pagar" value={formatCurrency(dashboardData.kpis.totalPayable)} icon={<ArrowTrendingDownIcon/>} colorClass="text-rose-600"/>
            </div>
            
            {dashboardData.cashFlow.length === 0 && dashboardData.expenses.length === 0 ? renderEmptyState() : (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md h-[350px]">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-center">Fluxo de Caixa Mensal</h3>
                         <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData.cashFlow} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4a5568' : '#e2e8f0'} />
                            <XAxis dataKey="month" tick={{ fill: theme === 'dark' ? '#a0aec0' : '#4a5568', fontSize: 12 }} />
                            <YAxis tick={{ fill: theme === 'dark' ? '#a0aec0' : '#4a5568', fontSize: 12 }} tickFormatter={(value) => `R$${Number(value)/1000}k`} />
                            {/* FIX: Add type 'any' to formatter value to fix TypeScript error where 'value' is of type 'unknown'. */}
<Tooltip formatter={(value: any) => (typeof value === 'number' ? formatCurrency(value) : String(value))} cursor={{ fill: 'rgba(128,128,128,0.1)' }} contentStyle={{backgroundColor: theme === 'dark' ? '#2d3748' : '#fff', border: '1px solid #4a5568'}}/>
                            <Legend />
                            <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart></ResponsiveContainer>
                    </div>
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md h-[350px]">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-center">Composição de Despesas</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><AnyPie data={dashboardData.expenses} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" fill="#8884d8" paddingAngle={5} dataKey="value" activeIndex={activeIndex} activeShape={(props: any) => renderActiveShape({...props, theme: theme})} onMouseEnter={onPieEnter}>
                                {dashboardData.expenses.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </AnyPie>
                            {/* FIX: Add type 'any' to formatter value to fix TypeScript error where 'value' is of type 'unknown'. */}
<Tooltip formatter={(value: any) => (typeof value === 'number' ? formatCurrency(value) : String(value))} contentStyle={{backgroundColor: theme === 'dark' ? '#2d3748' : '#fff', border: '1px solid #4a5568'}}/>
</PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Próximas Contas a Pagar</h3>
                        <div className="space-y-3">{dashboardData.upcomingPayables.length > 0 ? dashboardData.upcomingPayables.map(t => (
                            <div key={t.stringId} className="flex justify-between items-center text-sm"><p className="text-gray-700 dark:text-gray-300">{t.description}</p><div className="text-right"><p className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(t.amount)}</p><p className="text-xs text-gray-500">{new Date(t.dueDate!).toLocaleDateString('pt-BR')}</p></div></div>
                        )) : <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta vencendo nos próximos 7 dias.</p>}</div>
                    </div>
                     <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md border-l-4 border-red-500">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><ExclamationTriangleIcon/> Contas Vencidas</h3>
                         <div className="space-y-3">{dashboardData.overduePayables.length > 0 ? dashboardData.overduePayables.map(t => (
                            <div key={t.stringId} className="flex justify-between items-center text-sm"><p className="text-gray-700 dark:text-gray-300">{t.description}</p><div className="text-right"><p className="font-semibold text-red-600">{formatCurrency(t.amount)}</p><p className="text-xs text-red-500">{new Date(t.dueDate!).toLocaleDateString('pt-BR')}</p></div></div>
                        )) : <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta vencida.</p>}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-md">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Últimas Transações</h3>
                        <div className="space-y-3">{dashboardData.recentTransactions.length > 0 ? dashboardData.recentTransactions.map(t => (
                            <div key={t.stringId} className="flex justify-between items-center text-sm"><p className="text-gray-700 dark:text-gray-300">{t.description}</p><p className={`font-semibold ${t.type === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</p></div>
                        )) : <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma transação recente.</p>}</div>
                    </div>
                </div>
                </>
            )}
        </div>
    );
};

export default FinancialDashboard;