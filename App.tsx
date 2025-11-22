
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Users, Truck, Package, ClipboardList, FileBarChart, Plus, Trash2, ShoppingCart, AlertTriangle, FileText, Clock, CheckCircle, Edit, Search, Loader2, Calendar, Shield, LogOut, UserPlus, DollarSign, X, Target
} from 'lucide-react';
import { Customer, Supplier, Product, StockEntry, Order, OrderItem, ViewState, Promotion, Address, OrderStatus, User, CalendarEvent, Role, OrderType, SalesGoal } from './types';
import { storageService } from './services/storage';
import { Button, Card, Input, Select } from './components/UI';
import { generateBusinessReport } from './services/geminiService';
import { SalesChart, ProductStockChart, GoalsComparisonChart } from './components/ReportsCharts';
import { fetchCnpjData, formatCnpj } from './services/brasilApi';

// --- Utilities ---

const hasPermission = (user: User, view: ViewState): boolean => {
  if (user.role === 'ADMIN') return true;
  if (view === 'DASHBOARD' || view === 'AGENDA') return true;

  if (user.role === 'SELLER') {
    return ['NEW_ORDER', 'OPEN_ORDERS', 'CUSTOMERS', 'REPORTS', 'PAYMENTS', 'GOALS'].includes(view);
  }
  if (user.role === 'STOCK_MANAGER') {
    return ['PRODUCTS', 'INVENTORY', 'SUPPLIERS', 'REPORTS'].includes(view);
  }
  return false;
};

// --- Helper Components ---

const SignaturePad = ({ onSave, onClear }: { onSave: (data: string) => void, onClear: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onClear();
  };

  return (
    <div className="border-2 border-dashed border-gray-400 rounded bg-white touch-none">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="w-full h-40 cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="border-t p-2 flex justify-end">
        <button type="button" onClick={clearCanvas} className="text-xs text-red-600 hover:text-red-800 font-medium">
          Limpar Assinatura
        </button>
      </div>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const LoginView = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = storageService.getUsers();
    // Case sensitive check for security, though simple app
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Usuário ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <div className="text-center mb-8">
             <h1 className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-2">
               <Package className="w-8 h-8" />
               Sistema de Gestão
             </h1>
             <p className="text-gray-500">Acesso Restrito</p>
          </div>
          <form onSubmit={handleLogin}>
            <Input label="Usuário" value={username} onChange={(e: any) => setUsername(e.target.value)} />
            <Input label="Senha" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </Card>
      </div>
      <footer className="p-4 text-center text-gray-400 text-sm">
        HSP System Pro
      </footer>
    </div>
  );
};

const Dashboard = ({ orders, products, events }: any) => {
  // Revenue: Count 'delivered', 'completed', and 'partially_delivered'
  const revenueOrders = orders.filter((o: Order) => ['delivered', 'completed', 'partially_delivered'].includes(o.status));
  const totalRevenue = revenueOrders.reduce((sum: number, o: Order) => sum + o.total, 0);
  
  const lowStock = products.filter((p: Product) => p.stock < 5).length;
  
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const todaySales = orders.filter((o: Order) => 
    o.date.startsWith(today) && o.status !== 'canceled'
  ).length;

  const pendingOrders = orders.filter((o: Order) => o.status === 'pending' || o.status === 'partially_delivered').length;

  const upcomingEvents = events.filter((e: CalendarEvent) => e.date === today || e.date === tomorrow)
    .sort((a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-medium">Receita Realizada</h3>
          <p className="text-3xl font-bold text-gray-900">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="border-l-4 border-yellow-500">
          <h3 className="text-gray-500 text-sm font-medium">Pedidos em Aberto</h3>
          <p className="text-3xl font-bold text-gray-900">{pendingOrders}</p>
        </Card>
        <Card className="border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm font-medium">Estoque Baixo</h3>
          <p className="text-3xl font-bold text-gray-900">{lowStock}</p>
        </Card>
        <Card className="border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-medium">Vendas Hoje</h3>
          <p className="text-3xl font-bold text-gray-900">{todaySales}</p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="text-blue-600" size={20}/>
          Agenda: Hoje e Amanhã
        </h3>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500">Nenhum compromisso agendado.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((evt: CalendarEvent) => (
              <div key={evt.id} className={`p-3 rounded border-l-4 flex justify-between items-center ${evt.date === today ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-400'}`}>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {evt.title}
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-white border border-gray-200">
                      {evt.date === today ? 'Hoje' : 'Amanhã'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{evt.time} - {evt.description}</p>
                  {evt.relatedName && <p className="text-xs text-gray-500 mt-1">Vinculado a: {evt.relatedName}</p>}
                </div>
                <div className="text-right">
                   <span className={`text-xs font-bold px-2 py-1 rounded ${evt.type === 'VISIT' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                     {evt.type === 'VISIT' ? 'Visita' : 'Entrega'}
                   </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  
  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([]);

  // Edit State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Load Data on Mount
  useEffect(() => {
    setCustomers(storageService.getCustomers());
    setSuppliers(storageService.getSuppliers());
    setProducts(storageService.getProducts());
    setOrders(storageService.getOrders());
    setStockEntries(storageService.getStockEntries());
    setPromotions(storageService.getPromotions());
    setUsers(storageService.getUsers());
    setEvents(storageService.getEvents());
    setSalesGoals(storageService.getSalesGoals());
  }, []);

  // Save Data Effects
  useEffect(() => storageService.saveCustomers(customers), [customers]);
  useEffect(() => storageService.saveSuppliers(suppliers), [suppliers]);
  useEffect(() => storageService.saveProducts(products), [products]);
  useEffect(() => storageService.saveOrders(orders), [orders]);
  useEffect(() => storageService.saveStockEntries(stockEntries), [stockEntries]);
  useEffect(() => storageService.savePromotions(promotions), [promotions]);
  useEffect(() => storageService.saveUsers(users), [users]);
  useEffect(() => storageService.saveEvents(events), [events]);
  useEffect(() => storageService.saveSalesGoals(salesGoals), [salesGoals]);

  // --- Action Handlers ---
  const handleAddCustomer = (customer: Customer) => setCustomers([...customers, customer]);
  const handleDeleteCustomer = (id: string) => setCustomers(customers.filter(c => c.id !== id));

  const handleAddSupplier = (supplier: Supplier) => setSuppliers([...suppliers, supplier]);
  const handleDeleteSupplier = (id: string) => setSuppliers(suppliers.filter(s => s.id !== id));

  const handleAddProduct = (product: Product) => setProducts([...products, product]);
  const handleDeleteProduct = (id: string) => setProducts(products.filter(p => p.id !== id));

  const handleStockEntry = (entry: StockEntry) => {
    setStockEntries([...stockEntries, entry]);
    setProducts(products.map(p => 
      p.id === entry.productId ? { ...p, stock: p.stock + entry.quantity } : p
    ));
  };

  const handleAddUser = (user: User) => setUsers([...users, user]);
  const handleDeleteUser = (id: string) => {
    if (id === currentUser?.id) return alert("Você não pode excluir a si mesmo.");
    setUsers(users.filter(u => u.id !== id));
  };

  const handleAddEvent = (event: CalendarEvent) => setEvents([...events, event]);
  const handleDeleteEvent = (id: string) => setEvents(events.filter(e => e.id !== id));

  const handleSaveGoal = (goal: SalesGoal) => {
    const existing = salesGoals.findIndex(g => g.month === goal.month);
    if (existing >= 0) {
      const updated = [...salesGoals];
      updated[existing] = goal;
      setSalesGoals(updated);
    } else {
      setSalesGoals([...salesGoals, goal]);
    }
  };

  const handleSaveOrder = (order: Order) => {
    let updatedProducts = [...products];

    if (editingOrder) {
      updatedProducts = updatedProducts.map(p => {
        const oldItem = editingOrder.items.find(i => i.productId === p.id);
        return oldItem ? { ...p, stock: p.stock + oldItem.quantity } : p;
      });
      updatedProducts = updatedProducts.map(p => {
        const newItem = order.items.find(i => i.productId === p.id);
        return newItem ? { ...p, stock: p.stock - newItem.quantity } : p;
      });
      setOrders(orders.map(o => o.id === editingOrder.id ? order : o));
      setEditingOrder(null);
    } else {
      updatedProducts = updatedProducts.map(p => {
        const orderItem = order.items.find(i => i.productId === p.id);
        return orderItem ? { ...p, stock: p.stock - orderItem.quantity } : p;
      });
      setOrders([...orders, order]);
    }

    setProducts(updatedProducts);
    setView('OPEN_ORDERS');
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setView('NEW_ORDER');
  };

  const handleCancelOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (window.confirm("Tem certeza que deseja cancelar este pedido? O estoque será devolvido.")) {
      const updatedProducts = products.map(p => {
        const item = order.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.quantity } : p;
      });
      setProducts(updatedProducts);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'canceled' } : o));
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus, notes?: string) => {
    setOrders(orders.map(o => 
      o.id === orderId 
        ? { ...o, status, deliveryNotes: notes ? (o.deliveryNotes ? o.deliveryNotes + '\n' + notes : notes) : o.deliveryNotes } 
        : o
    ));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('DASHBOARD');
  };

  // --- Render Logic ---

  if (!currentUser) {
    return <LoginView onLogin={setCurrentUser} />;
  }

  const renderContent = () => {
    switch (view) {
      case 'DASHBOARD': return <Dashboard orders={orders} products={products} customers={customers} events={events} />;
      case 'CUSTOMERS': return <CustomerView customers={customers} onAdd={handleAddCustomer} onDelete={handleDeleteCustomer} />;
      case 'SUPPLIERS': return <SupplierView suppliers={suppliers} onAdd={handleAddSupplier} onDelete={handleDeleteSupplier} />;
      case 'PRODUCTS': return <ProductView products={products} suppliers={suppliers} onAdd={handleAddProduct} onDelete={handleDeleteProduct} onStockEntry={handleStockEntry} />;
      case 'INVENTORY': return <ProductView products={products} suppliers={suppliers} onAdd={handleAddProduct} onDelete={handleDeleteProduct} onStockEntry={handleStockEntry} defaultTab="stock" />;
      case 'NEW_ORDER': return <NewOrderView customers={customers} products={products} onSaveOrder={handleSaveOrder} editingOrder={editingOrder} onCancelEdit={() => { setEditingOrder(null); setView('OPEN_ORDERS'); }} />;
      case 'OPEN_ORDERS': return <OpenOrdersView orders={orders} onUpdateStatus={handleUpdateOrderStatus} onEdit={handleEditOrder} onCancel={handleCancelOrder} />;
      case 'REPORTS': return <ReportsView orders={orders} customers={customers} products={products} user={currentUser} />;
      case 'AGENDA': return <AgendaView events={events} customers={customers} suppliers={suppliers} onAdd={handleAddEvent} onDelete={handleDeleteEvent} />;
      case 'USERS': return <UserManagementView users={users} onAdd={handleAddUser} onDelete={handleDeleteUser} currentUser={currentUser} />;
      case 'PAYMENTS': return <PaymentsView orders={orders} />;
      case 'GOALS': return <GoalsView salesGoals={salesGoals} orders={orders} onSaveGoal={handleSaveGoal} />;
      default: return <Dashboard orders={orders} products={products} events={events} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col print:hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <Package className="w-8 h-8" />
            Sistema de Gestão
          </h1>
          <p className="text-xs text-gray-500 mt-1">Olá, {currentUser.name}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} />
          <SidebarItem icon={Calendar} label="Agenda" active={view === 'AGENDA'} onClick={() => setView('AGENDA')} />
          
          {hasPermission(currentUser, 'OPEN_ORDERS') && (
             <SidebarItem icon={Clock} label="Pedidos em Aberto" active={view === 'OPEN_ORDERS'} onClick={() => setView('OPEN_ORDERS')} />
          )}
          {hasPermission(currentUser, 'PAYMENTS') && (
             <SidebarItem icon={DollarSign} label="Pagamentos" active={view === 'PAYMENTS'} onClick={() => setView('PAYMENTS')} />
          )}
          {hasPermission(currentUser, 'NEW_ORDER') && (
             <SidebarItem icon={ShoppingCart} label="Novo Pedido" active={view === 'NEW_ORDER'} onClick={() => { setEditingOrder(null); setView('NEW_ORDER'); }} />
          )}
          {hasPermission(currentUser, 'CUSTOMERS') && (
             <SidebarItem icon={Users} label="Clientes" active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} />
          )}
          {hasPermission(currentUser, 'SUPPLIERS') && (
             <SidebarItem icon={Truck} label="Fornecedores" active={view === 'SUPPLIERS'} onClick={() => setView('SUPPLIERS')} />
          )}
          {hasPermission(currentUser, 'PRODUCTS') && (
             <SidebarItem icon={Package} label="Produtos" active={view === 'PRODUCTS'} onClick={() => setView('PRODUCTS')} />
          )}
          {hasPermission(currentUser, 'INVENTORY') && (
             <SidebarItem icon={ClipboardList} label="Estoque" active={view === 'INVENTORY'} onClick={() => setView('INVENTORY')} />
          )}
          {hasPermission(currentUser, 'GOALS') && (
             <SidebarItem icon={Target} label="Metas" active={view === 'GOALS'} onClick={() => setView('GOALS')} />
          )}
          {hasPermission(currentUser, 'REPORTS') && (
             <SidebarItem icon={FileBarChart} label="Relatórios" active={view === 'REPORTS'} onClick={() => setView('REPORTS')} />
          )}
          {currentUser.role === 'ADMIN' && (
             <SidebarItem icon={Shield} label="Usuários" active={view === 'USERS'} onClick={() => setView('USERS')} />
          )}
        </nav>
        <div className="p-4 border-t">
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-2 rounded text-red-600 hover:bg-red-50">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white shadow-sm p-6 print:hidden flex-shrink-0">
          <h2 className="text-2xl font-semibold text-gray-800">
            {view === 'DASHBOARD' && 'Visão Geral'}
            {view === 'AGENDA' && 'Agenda de Visitas e Entregas'}
            {view === 'CUSTOMERS' && 'Gerenciar Clientes'}
            {view === 'SUPPLIERS' && 'Gerenciar Fornecedores'}
            {view === 'PRODUCTS' && 'Catálogo de Produtos'}
            {view === 'INVENTORY' && 'Controle de Estoque'}
            {view === 'NEW_ORDER' && (editingOrder ? 'Editar Pedido' : 'Emitir Pedido')}
            {view === 'OPEN_ORDERS' && 'Pedidos em Aberto'}
            {view === 'REPORTS' && 'Central de Relatórios'}
            {view === 'USERS' && 'Gerenciamento de Usuários'}
            {view === 'PAYMENTS' && 'Controle de Pagamentos'}
            {view === 'GOALS' && 'Metas de Vendas'}
          </h2>
        </header>
        <div className="p-6 flex-1">
          {renderContent()}
        </div>
        <footer className="p-4 text-center text-gray-400 text-sm border-t mt-auto print:hidden bg-gray-50">
          HSP System Pro
        </footer>
      </main>
    </div>
  );
};

// --- Page Components ---

const GoalsView = ({ salesGoals, orders, onSaveGoal }: any) => {
  const [form, setForm] = useState({ month: new Date().toISOString().slice(0, 7), wholesale: 0, retail: 0 });

  // Prepare data for current month
  const currentMonth = form.month; // YYYY-MM
  const goal = salesGoals.find((g: SalesGoal) => g.month === currentMonth);

  // Calculate Actuals
  const ordersThisMonth = orders.filter((o: Order) => o.date.startsWith(currentMonth) && o.status !== 'canceled');
  const actualRetail = ordersThisMonth.filter((o: Order) => !o.orderType || o.orderType === 'RETAIL').reduce((sum: number, o: Order) => sum + o.total, 0);
  const actualWholesale = ordersThisMonth.filter((o: Order) => o.orderType === 'WHOLESALE').reduce((sum: number, o: Order) => sum + o.total, 0);

  // Prepare data for chart (Last 6 months + current)
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = d.toISOString().slice(0, 7);
      
      const g = salesGoals.find((sg: SalesGoal) => sg.month === mStr);
      const os = orders.filter((o: Order) => o.date.startsWith(mStr) && o.status !== 'canceled');
      
      const retail = os.filter((o: Order) => !o.orderType || o.orderType === 'RETAIL').reduce((s: number, o: Order) => s + o.total, 0);
      const wholesale = os.filter((o: Order) => o.orderType === 'WHOLESALE').reduce((s: number, o: Order) => s + o.total, 0);

      data.push({
        name: mStr,
        retailTarget: g?.retailTarget || 0,
        wholesaleTarget: g?.wholesaleTarget || 0,
        retailActual: retail,
        wholesaleActual: wholesale
      });
    }
    return data;
  }, [salesGoals, orders]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGoal({
      id: goal?.id || crypto.randomUUID(),
      month: form.month,
      wholesaleTarget: form.wholesale,
      retailTarget: form.retail
    });
    alert('Metas salvas com sucesso!');
  };

  const renderProgress = (label: string, current: number, target: number, color: string) => {
    const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const remaining = Math.max(0, target - current);
    const isMet = current >= target && target > 0;

    return (
      <Card className={`border-l-4 ${isMet ? 'border-green-500' : color}`}>
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-gray-700">{label}</h4>
          {isMet && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">META BATIDA!</span>}
        </div>
        <div className="flex justify-between text-sm mb-1">
           <span>Realizado: R$ {current.toFixed(2)}</span>
           <span>Meta: R$ {target.toFixed(2)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div className={`h-4 rounded-full ${isMet ? 'bg-green-500' : color.replace('border-', 'bg-')}`} style={{ width: `${percent}%` }}></div>
        </div>
        {!isMet && target > 0 && (
          <p className="text-sm text-gray-500">Faltam <span className="font-bold text-red-500">R$ {remaining.toFixed(2)}</span> para bater a meta.</p>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Section: Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderProgress("Varejo", actualRetail, goal?.retailTarget || 0, "border-blue-500")}
        {renderProgress("Atacado", actualWholesale, goal?.wholesaleTarget || 0, "border-purple-500")}
      </div>

      {/* Chart Section */}
      <Card>
        <h3 className="font-bold text-lg mb-4">Histórico de Metas vs. Vendas</h3>
        <GoalsComparisonChart data={chartData} />
      </Card>

      {/* Settings Section */}
      <Card>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Target size={20} /> Configurar Metas</h3>
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-4 items-end">
          <Input label="Mês de Referência" type="month" value={form.month} onChange={(e: any) => setForm({...form, month: e.target.value})} />
          <Input label="Meta Varejo (R$)" type="number" value={form.retail} onChange={(e: any) => setForm({...form, retail: parseFloat(e.target.value)})} />
          <Input label="Meta Atacado (R$)" type="number" value={form.wholesale} onChange={(e: any) => setForm({...form, wholesale: parseFloat(e.target.value)})} />
          <div className="mb-4">
            <Button type="submit">Salvar Meta</Button>
          </div>
        </form>
        <p className="text-sm text-gray-500 mt-2">Defina as metas para o mês selecionado. O gráfico acima será atualizado automaticamente.</p>
      </Card>
    </div>
  );
};

const PaymentsView = ({ orders }: { orders: Order[] }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Show pending/delivered/partially delivered. Exclude canceled.
  const receivables = orders.filter(o => o.status !== 'canceled').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const OrderReceiptModal = ({ order, onClose }: { order: Order, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 print:hidden">
          <X size={24} />
        </button>
        <div className="p-8">
          <div className="flex justify-between items-center mb-8 print:hidden">
            <h2 className="text-xl font-bold">Detalhes do Pedido</h2>
            <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
          </div>

          <div className="border-b pb-4 mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Pedido #{order.id.slice(0, 8)}</h1>
            <p className="text-gray-500">Data: {new Date(order.date).toLocaleDateString()}</p>
            <p className="text-gray-500 font-bold uppercase mt-2">{order.status === 'pending' ? 'Em Aberto' : order.status}</p>
            <p className="text-sm text-gray-500 mt-1">Tipo: {order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-gray-600 font-bold uppercase text-xs mb-2">Cliente</h3>
            <p className="font-bold text-lg">{order.customerName}</p>
            <p>{order.customerAddress.street}, {order.customerAddress.number}</p>
            <p>{order.customerAddress.city} - {order.customerAddress.state}, {order.customerAddress.zip}</p>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left">
                <th className="py-2">Produto</th>
                <th className="py-2 text-right">Qtd</th>
                <th className="py-2 text-right">Preço Unit.</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">R$ {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-12 print:break-inside-avoid">
            <div className="w-64">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>R$ {order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-red-500">
                <span>Desconto:</span>
                <span>- R$ {order.discountValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-xl">
                <span>Total:</span>
                <span>R$ {order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-4 print:break-inside-avoid">
             <p className="text-sm font-bold mb-2">Assinatura do Cliente:</p>
             {order.signature ? (
               <img src={order.signature} alt="Assinatura" className="h-20 border border-gray-300 rounded bg-gray-50" />
             ) : (
               <div className="h-20 border border-gray-300 border-dashed rounded flex items-center justify-center text-gray-400">
                 Não assinado
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {selectedOrder && <OrderReceiptModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Valor Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receivables.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                   <td className="p-3">{new Date(order.date).toLocaleDateString()}</p>
                   <td className="p-3 font-medium">{order.customerName}</td>
                   <td className="p-3 text-sm">
                     <span className={`px-2 py-1 rounded text-xs ${order.orderType === 'WHOLESALE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                       {order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}
                     </span>
                   </td>
                   <td className="p-3 font-bold text-green-600">R$ {order.total.toFixed(2)}</td>
                   <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'completed' || order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'pending' ? 'Pendente' : order.status === 'delivered' ? 'Entregue' : order.status}
                      </span>
                   </td>
                   <td className="p-3">
                     <Button variant="outline" className="text-xs py-1 px-2">Ver Nota</Button>
                   </td>
                </tr>
              ))}
              {receivables.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum pagamento ou pedido em aberto.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const UserManagementView = ({ users, onAdd, onDelete, currentUser }: any) => {
  const [form, setForm] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'SELLER' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    onAdd({ ...form, id: crypto.randomUUID() } as User);
    setForm({ name: '', username: '', password: '', role: 'SELLER' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-lg font-medium mb-4">Cadastrar Usuário</h3>
        <form onSubmit={handleSubmit}>
          <Input label="Nome Completo" value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} required />
          <Input label="Usuário (Login)" value={form.username} onChange={(e: any) => setForm({...form, username: e.target.value})} required />
          <Input label="Senha" type="password" value={form.password} onChange={(e: any) => setForm({...form, password: e.target.value})} required />
          
          <Select label="Permissão" value={form.role} onChange={(e: any) => setForm({...form, role: e.target.value})}>
            <option value="SELLER">Vendedor (Acesso a Clientes, Pedidos, Agenda)</option>
            <option value="STOCK_MANAGER">Estoquista (Acesso a Produtos, Estoque, Fornecedores)</option>
            <option value="ADMIN">Administrador (Acesso Total)</option>
          </Select>

          <Button type="submit" className="w-full mt-4">Criar Usuário</Button>
        </form>
      </Card>
      <Card>
        <h3 className="text-lg font-medium mb-4">Usuários do Sistema</h3>
        <ul className="divide-y">
          {users.map((u: User) => (
            <li key={u.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-sm text-gray-500">Login: {u.username}</p>
                <p className="text-xs text-blue-600 font-bold">{u.role}</p>
              </div>
              {u.id !== currentUser.id && (
                <Button variant="danger" onClick={() => onDelete(u.id)} className="p-2"><Trash2 size={16} /></Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

const AgendaView = ({ events, customers, suppliers, onAdd, onDelete }: any) => {
  const [form, setForm] = useState<Partial<CalendarEvent>>({
    title: '', description: '', date: new Date().toISOString().split('T')[0], time: '09:00', type: 'VISIT', relatedId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) return;
    
    let relatedName = '';
    if (form.type === 'VISIT' && form.relatedId) {
      relatedName = customers.find((c: any) => c.id === form.relatedId)?.name || '';
    } else if (form.type === 'DELIVERY' && form.relatedId) {
      relatedName = suppliers.find((s: any) => s.id === form.relatedId)?.name || '';
    }

    onAdd({ ...form, id: crypto.randomUUID(), relatedName } as CalendarEvent);
    setForm({ title: '', description: '', date: form.date, time: '09:00', type: 'VISIT', relatedId: '' });
  };

  // Sort events by date desc
  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 h-fit">
        <h3 className="text-lg font-medium mb-4">Novo Compromisso</h3>
        <form onSubmit={handleSubmit}>
          <Select label="Tipo" value={form.type} onChange={(e: any) => setForm({...form, type: e.target.value, relatedId: ''})}>
            <option value="VISIT">Visita a Cliente</option>
            <option value="DELIVERY">Entrega de Fornecedor</option>
            <option value="OTHER">Outro</option>
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <Input label="Data" type="date" value={form.date} onChange={(e: any) => setForm({...form, date: e.target.value})} required />
            <Input label="Hora" type="time" value={form.time} onChange={(e: any) => setForm({...form, time: e.target.value})} required />
          </div>

          {form.type === 'VISIT' && (
             <Select label="Cliente" value={form.relatedId} onChange={(e: any) => setForm({...form, relatedId: e.target.value, title: `Visita: ${e.target.options[e.target.selectedIndex].text}`})}>
               <option value="">Selecione o Cliente</option>
               {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
             </Select>
          )}

          {form.type === 'DELIVERY' && (
             <Select label="Fornecedor" value={form.relatedId} onChange={(e: any) => setForm({...form, relatedId: e.target.value, title: `Entrega: ${e.target.options[e.target.selectedIndex].text}`})}>
               <option value="">Selecione o Fornecedor</option>
               {suppliers.map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}
             </Select>
          )}

          <Input label="Título" value={form.title} onChange={(e: any) => setForm({...form, title: e.target.value})} required />
          <Input label="Descrição / Notas" value={form.description} onChange={(e: any) => setForm({...form, description: e.target.value})} />

          <Button type="submit" className="w-full mt-4">Agendar</Button>
        </form>
      </Card>

      <div className="lg:col-span-2 space-y-4">
         <h3 className="text-lg font-bold text-gray-700 mb-2">Próximos Eventos</h3>
         {sortedEvents.length === 0 ? <p className="text-gray-500">Nenhum evento agendado.</p> : sortedEvents.map(evt => (
           <Card key={evt.id} className={`flex justify-between items-center ${new Date(evt.date) < new Date() ? 'opacity-60' : ''}`}>
             <div className="flex gap-4">
                <div className="bg-gray-100 p-3 rounded text-center min-w-[80px]">
                   <div className="text-xs font-bold text-gray-500">{new Date(evt.date).getFullYear()}</div>
                   <div className="text-lg font-bold text-blue-600">{new Date(evt.date).getDate()}</div>
                   <div className="text-xs text-gray-500 uppercase">{new Date(evt.date).toLocaleString('pt-BR', { month: 'short' })}</div>
                </div>
                <div>
                   <h4 className="font-bold text-lg">{evt.title}</h4>
                   <p className="text-gray-600 text-sm flex items-center gap-2">
                     <Clock size={14} /> {evt.time} 
                     {evt.relatedName && <span className="bg-gray-100 px-2 py-0.5 rounded text-xs ml-2">{evt.relatedName}</span>}
                   </p>
                   <p className="text-gray-500 text-sm mt-1">{evt.description}</p>
                </div>
             </div>
             <Button variant="danger" onClick={() => onDelete(evt.id)} className="p-2"><Trash2 size={16}/></Button>
           </Card>
         ))}
      </div>
    </div>
  );
};

const OpenOrdersView = ({ orders, onUpdateStatus, onEdit, onCancel }: any) => {
  const openOrders = orders.filter((o: Order) => o.status === 'pending' || o.status === 'partially_delivered');

  const handlePartial = (id: string) => {
    const note = prompt("Adicione uma nota sobre o que falta entregar ou observações:");
    if (note !== null) {
      onUpdateStatus(id, 'partially_delivered', note);
    }
  };

  if (openOrders.length === 0) {
    return <Card><p className="text-center text-gray-500 py-8">Não há pedidos em aberto no momento.</p></Card>;
  }

  return (
    <div className="space-y-4">
      {openOrders.map((order: Order) => (
        <Card key={order.id} className="flex flex-col lg:flex-row justify-between gap-4 border-l-4 border-yellow-400">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-lg">Pedido #{order.id.slice(0, 8)}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${order.status === 'partially_delivered' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {order.status === 'partially_delivered' ? 'Parcialmente Entregue' : 'Pendente'}
              </span>
              <span className="text-xs text-gray-500 border border-gray-300 px-2 py-0.5 rounded">
                {order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}
              </span>
            </div>
            <p className="text-gray-700 font-medium">{order.customerName}</p>
            <p className="text-sm text-gray-500 mb-2">{new Date(order.date).toLocaleDateString()} • {order.customerAddress.city}</p>
            <div className="bg-gray-50 p-2 rounded text-sm mb-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-gray-600">
                  <span>{item.quantity}x {item.productName}</span>
                  <span>R$ {item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="font-bold text-right">Total: R$ {order.total.toFixed(2)}</div>
            {order.deliveryNotes && (
              <div className="mt-2 p-2 bg-orange-50 text-orange-800 text-sm rounded border border-orange-100">
                <strong>Notas:</strong> {order.deliveryNotes}
              </div>
            )}
          </div>
          
          <div className="flex flex-col justify-center gap-2 min-w-[200px] border-l pl-0 lg:pl-4 border-gray-100">
            <Button variant="success" onClick={() => onUpdateStatus(order.id, 'delivered')} className="flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Entregar Tudo
            </Button>
            <Button variant="secondary" onClick={() => handlePartial(order.id)} className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white">
              <Clock size={16} /> Entrega Parcial
            </Button>
            <Button variant="outline" onClick={() => onEdit(order)} className="flex items-center justify-center gap-2">
              <Edit size={16} /> Editar
            </Button>
            <Button variant="danger" onClick={() => onCancel(order.id)} className="flex items-center justify-center gap-2">
              <Trash2 size={16} /> Cancelar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

const CustomerView = ({ customers, onAdd, onDelete }: any) => {
  const [form, setForm] = useState<Partial<Customer>>({
    name: '', email: '', phone: '', cnpj: '',
    address: { street: '', number: '', city: '', state: '', zip: '', neighborhood: '' }
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const handleCnpjSearch = async () => {
    if (!form.cnpj) return alert("Digite o CNPJ");
    setLoadingCnpj(true);
    try {
      const data = await fetchCnpjData(form.cnpj);
      setForm(prev => ({
        ...prev,
        name: data.nome_fantasia || data.razao_social,
        email: data.email,
        phone: data.ddd_telefone_1,
        address: {
          street: data.logradouro,
          number: data.numero,
          city: data.municipio,
          state: data.uf,
          zip: data.cep,
          neighborhood: data.bairro
        }
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onAdd({ ...form, id: crypto.randomUUID() } as Customer);
    setForm({ name: '', email: '', phone: '', cnpj: '', address: { street: '', number: '', city: '', state: '', zip: '', neighborhood: '' } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-lg font-medium mb-4">Novo Cliente</h3>
        <form onSubmit={handleSubmit}>
           <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ (Somente Números)</label>
            <div className="flex gap-2">
              <input 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500" 
                value={form.cnpj} 
                onChange={(e) => setForm({...form, cnpj: formatCnpj(e.target.value)})} 
                placeholder="00.000.000/0000-00"
              />
              <Button type="button" onClick={handleCnpjSearch} disabled={loadingCnpj} className="whitespace-nowrap min-w-[100px] flex items-center justify-center">
                {loadingCnpj ? <Loader2 className="animate-spin" /> : <><Search size={16} className="mr-1"/> Buscar</>}
              </Button>
            </div>
          </div>

          <Input label="Nome / Razão Social" value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e: any) => setForm({...form, email: e.target.value})} />
            <Input label="Telefone" value={form.phone} onChange={(e: any) => setForm({...form, phone: e.target.value})} />
          </div>
          
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Endereço</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Input label="Rua" value={form.address?.street} onChange={(e: any) => setForm({...form, address: {...form.address!, street: e.target.value}})} /></div>
              <Input label="Número" value={form.address?.number} onChange={(e: any) => setForm({...form, address: {...form.address!, number: e.target.value}})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
               <Input label="Bairro" value={form.address?.neighborhood} onChange={(e: any) => setForm({...form, address: {...form.address!, neighborhood: e.target.value}})} />
               <Input label="CEP" value={form.address?.zip} onChange={(e: any) => setForm({...form, address: {...form.address!, zip: e.target.value}})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Cidade" value={form.address?.city} onChange={(e: any) => setForm({...form, address: {...form.address!, city: e.target.value}})} />
              <Input label="Estado" value={form.address?.state} onChange={(e: any) => setForm({...form, address: {...form.address!, state: e.target.value}})} />
            </div>
          </div>
          <Button type="submit" className="w-full mt-4">Cadastrar Cliente</Button>
        </form>
      </Card>
      <Card className="overflow-auto max-h-[600px]">
        <h3 className="text-lg font-medium mb-4">Clientes Cadastrados</h3>
        <ul className="divide-y">
          {customers.map((c: Customer) => (
            <li key={c.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{c.name}</p>
                {c.cnpj && <p className="text-xs bg-blue-50 text-blue-600 inline-block px-1 rounded">{c.cnpj}</p>}
                <p className="text-sm text-gray-500">{c.email} • {c.phone}</p>
                <p className="text-xs text-gray-400">{c.address.city}/{c.address.state}</p>
              </div>
              <Button variant="danger" onClick={() => onDelete(c.id)} className="p-2"><Trash2 size={16} /></Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

const SupplierView = ({ suppliers, onAdd, onDelete }: any) => {
  const [form, setForm] = useState<Partial<Supplier>>({ 
    name: '', contact: '', email: '', cnpj: '',
    address: { street: '', number: '', city: '', state: '', zip: '', neighborhood: '' }
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const handleCnpjSearch = async () => {
    if (!form.cnpj) return alert("Digite o CNPJ");
    setLoadingCnpj(true);
    try {
      const data = await fetchCnpjData(form.cnpj);
      setForm(prev => ({
        ...prev,
        name: data.razao_social,
        contact: data.nome_fantasia || data.razao_social, // Use fantasy name as 'contact' alias or primary name
        email: data.email,
        address: {
          street: data.logradouro,
          number: data.numero,
          city: data.municipio,
          state: data.uf,
          zip: data.cep,
          neighborhood: data.bairro
        }
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onAdd({ ...form, id: crypto.randomUUID() } as Supplier);
    setForm({ name: '', contact: '', email: '', cnpj: '', address: { street: '', number: '', city: '', state: '', zip: '', neighborhood: '' } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-lg font-medium mb-4">Novo Fornecedor</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ (Somente Números)</label>
            <div className="flex gap-2">
              <input 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500" 
                value={form.cnpj} 
                onChange={(e) => setForm({...form, cnpj: formatCnpj(e.target.value)})} 
                placeholder="00.000.000/0000-00"
              />
              <Button type="button" onClick={handleCnpjSearch} disabled={loadingCnpj} className="whitespace-nowrap min-w-[100px] flex items-center justify-center">
                {loadingCnpj ? <Loader2 className="animate-spin" /> : <><Search size={16} className="mr-1"/> Buscar</>}
              </Button>
            </div>
          </div>

          <Input label="Razão Social" value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} required />
          <Input label="Nome Contato / Fantasia" value={form.contact} onChange={(e: any) => setForm({...form, contact: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={(e: any) => setForm({...form, email: e.target.value})} />
          
          <div className="mt-4 border-t pt-4 bg-gray-50 p-3 rounded">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Endereço (Opcional)</h4>
            <p className="text-xs text-gray-400 mb-2">Preenchido automaticamente pelo CNPJ</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Input label="Rua" value={form.address?.street} onChange={(e: any) => setForm({...form, address: {...form.address!, street: e.target.value}})} /></div>
              <Input label="Número" value={form.address?.number} onChange={(e: any) => setForm({...form, address: {...form.address!, number: e.target.value}})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Cidade" value={form.address?.city} onChange={(e: any) => setForm({...form, address: {...form.address!, city: e.target.value}})} />
              <Input label="Estado" value={form.address?.state} onChange={(e: any) => setForm({...form, address: {...form.address!, state: e.target.value}})} />
            </div>
          </div>

          <Button type="submit" className="w-full mt-4">Cadastrar Fornecedor</Button>
        </form>
      </Card>
      <Card>
        <h3 className="text-lg font-medium mb-4">Fornecedores</h3>
        <ul className="divide-y">
          {suppliers.map((s: Supplier) => (
            <li key={s.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{s.name}</p>
                {s.cnpj && <p className="text-xs bg-blue-50 text-blue-600 inline-block px-1 rounded">{s.cnpj}</p>}
                <p className="text-sm text-gray-500">{s.contact} • {s.email}</p>
              </div>
              <Button variant="danger" onClick={() => onDelete(s.id)} className="p-2"><Trash2 size={16} /></Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

const ProductView = ({ products, suppliers, onAdd, onDelete, onStockEntry, defaultTab = 'products' }: any) => {
  const [tab, setTab] = useState(defaultTab);
  const [prodForm, setProdForm] = useState<Partial<Product>>({ name: '', price: 0, costPrice: 0, description: '', image: '', supplierId: '' });
  const [stockForm, setStockForm] = useState<Partial<StockEntry>>({ productId: '', supplierId: '', quantity: 0 });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProdForm({ ...prodForm, image: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleProdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name) return;
    onAdd({ ...prodForm, id: crypto.randomUUID(), stock: 0 } as Product);
    setProdForm({ name: '', price: 0, costPrice: 0, description: '', image: '', supplierId: '' });
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.productId || !stockForm.quantity) return;
    onStockEntry({ ...stockForm, id: crypto.randomUUID(), date: new Date().toISOString(), cost: 0 } as StockEntry);
    setStockForm({ productId: '', supplierId: '', quantity: 0 });
    alert('Entrada de estoque realizada com sucesso!');
  };

  return (
    <div>
      <div className="flex space-x-4 mb-6">
        <Button variant={tab === 'products' ? 'primary' : 'outline'} onClick={() => setTab('products')}>Produtos</Button>
        <Button variant={tab === 'stock' ? 'primary' : 'outline'} onClick={() => setTab('stock')}>Entrada de Estoque</Button>
      </div>

      {tab === 'products' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Cadastrar Produto</h3>
            <form onSubmit={handleProdSubmit}>
              <Input label="Nome do Produto" value={prodForm.name} onChange={(e: any) => setProdForm({...prodForm, name: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Preço Venda (R$)" type="number" step="0.01" value={prodForm.price} onChange={(e: any) => setProdForm({...prodForm, price: parseFloat(e.target.value)})} />
                <Input label="Preço Custo (R$)" type="number" step="0.01" value={prodForm.costPrice} onChange={(e: any) => setProdForm({...prodForm, costPrice: parseFloat(e.target.value)})} />
              </div>
              
              <Select label="Fornecedor" value={prodForm.supplierId} onChange={(e: any) => setProdForm({...prodForm, supplierId: e.target.value})}>
                <option value="">Selecione um Fornecedor</option>
                {suppliers.map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>

              <Input label="Descrição" value={prodForm.description} onChange={(e: any) => setProdForm({...prodForm, description: e.target.value})} />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto do Produto</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
              </div>
              <Button type="submit" className="w-full">Salvar Produto</Button>
            </form>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((p: Product) => (
              <Card key={p.id} className="flex flex-col justify-between">
                <div>
                  {p.image && <img src={p.image} alt={p.name} className="w-full h-32 object-cover rounded mb-2" />}
                  <h4 className="font-bold text-lg">{p.name}</h4>
                  <p className="text-gray-600">R$ {p.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Estoque: {p.stock}</p>
                  {p.supplierId && (
                    <p className="text-xs text-blue-500 mt-1 truncate">
                      Fornecedor: {suppliers.find((s: Supplier) => s.id === p.supplierId)?.name || 'N/A'}
                    </p>
                  )}
                </div>
                <Button variant="danger" onClick={() => onDelete(p.id)} className="mt-2 w-full text-sm">Excluir</Button>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Entrada de Produtos</h3>
            <form onSubmit={handleStockSubmit}>
              <Select label="Produto" value={stockForm.productId} onChange={(e: any) => setStockForm({...stockForm, productId: e.target.value})}>
                <option value="">Selecione um Produto</option>
                {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name} (Atual: {p.stock})</option>)}
              </Select>
              <Select label="Fornecedor" value={stockForm.supplierId} onChange={(e: any) => setStockForm({...stockForm, supplierId: e.target.value})}>
                <option value="">Selecione um Fornecedor</option>
                {suppliers.map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Quantidade" type="number" value={stockForm.quantity} onChange={(e: any) => setStockForm({...stockForm, quantity: parseInt(e.target.value)})} required />
              <Button type="submit" className="w-full" variant="success">Adicionar ao Estoque</Button>
            </form>
          </Card>
          <Card>
             <h3 className="text-lg font-medium mb-4">Estoque Atual</h3>
             <table className="min-w-full text-left text-sm">
               <thead className="bg-gray-50"><tr><th className="p-2">Produto</th><th className="p-2">Qtd</th></tr></thead>
               <tbody>
                 {products.map((p: Product) => (
                   <tr key={p.id} className="border-t">
                     <td className="p-2">{p.name}</td>
                     <td className={`p-2 font-bold ${p.stock < 5 ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </Card>
        </div>
      )}
    </div>
  );
};

const NewOrderView = ({ customers, products, onSaveOrder, editingOrder, onCancelEdit }: any) => {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('value');
  const [discountVal, setDiscountVal] = useState(0);
  const [signatureData, setSignatureData] = useState<string>("");
  const [orderType, setOrderType] = useState<OrderType>('RETAIL');
  const [finishedOrder, setFinishedOrder] = useState<Order | null>(null);

  // Load editing order
  useEffect(() => {
    if (editingOrder) {
      const client = customers.find((c: Customer) => c.id === editingOrder.customerId);
      setSelectedClient(client || null);
      
      const loadedCart = editingOrder.items.map((item: OrderItem) => {
        const product = products.find((p: Product) => p.id === item.productId);
        return product ? { product, qty: item.quantity } : null;
      }).filter(Boolean);
      setCart(loadedCart);
      
      setDiscountVal(editingOrder.discountValue > 0 ? editingOrder.discountValue : editingOrder.discountPercent);
      setDiscountType(editingOrder.discountValue > 0 ? 'value' : 'percent');
      setSignatureData(editingOrder.signature || "");
      setOrderType(editingOrder.orderType || 'RETAIL');
    }
  }, [editingOrder, customers, products]);

  const addToCart = (productId: string, qty: number) => {
    const product = products.find((p: Product) => p.id === productId);
    if (!product || qty <= 0) return;

    let availableStock = product.stock;
    if (editingOrder) {
        const oldItem = editingOrder.items.find((i: any) => i.productId === productId);
        if (oldItem) availableStock += oldItem.quantity;
    }

    const existingInCart = cart.find(item => item.product.id === productId);
    const currentCartQty = existingInCart ? existingInCart.qty : 0;
    const desiredTotal = currentCartQty + qty;

    if (desiredTotal > availableStock) {
       const confirm = window.confirm(`Estoque insuficiente (Disponível: ${availableStock}). Deseja adicionar assim mesmo?`);
       if (!confirm) return;
    }

    if (existingInCart) {
      setCart(cart.map(item => item.product.id === productId ? { ...item, qty: item.qty + qty } : item));
    } else {
      setCart([...cart, { product, qty }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    let total = subtotal;
    let dVal = 0;
    let dPercent = 0;

    if (discountType === 'value') {
      total -= discountVal;
      dVal = discountVal;
      if (subtotal > 0) dPercent = (discountVal / subtotal) * 100;
    } else {
      const amount = subtotal * (discountVal / 100);
      total -= amount;
      dPercent = discountVal;
      dVal = amount;
    }
    return { subtotal, total, dVal, dPercent };
  };

  const handleFinish = () => {
    if (!selectedClient) return;
    if (!signatureData) {
      const confirm = window.confirm("O cliente não assinou. Deseja concluir sem assinatura?");
      if (!confirm) return;
    }

    const { subtotal, total, dVal, dPercent } = calculateTotal();
    
    const order: Order = {
      id: editingOrder ? editingOrder.id : crypto.randomUUID(),
      customerId: selectedClient.id,
      customerName: selectedClient.name,
      customerAddress: selectedClient.address,
      items: cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.qty,
        unitPrice: i.product.price,
        total: i.product.price * i.qty
      })),
      subtotal,
      discountValue: dVal,
      discountPercent: dPercent,
      total,
      date: editingOrder ? editingOrder.date : new Date().toISOString(),
      status: editingOrder ? editingOrder.status : 'pending',
      deliveryNotes: editingOrder ? editingOrder.deliveryNotes : '',
      signature: signatureData,
      orderType: orderType
    };

    onSaveOrder(order);
    setFinishedOrder(order);
    setStep(3);
  };

  // Order Print View
  if (step === 3 && finishedOrder) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 shadow-lg print:shadow-none print:w-full">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <h2 className="text-2xl font-bold text-green-600">Pedido Salvo com Sucesso!</h2>
          <div className="space-x-2">
             <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
             <Button onClick={() => window.location.reload()}>Novo Pedido</Button>
          </div>
        </div>

        <div className="border-b pb-4 mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Pedido #{finishedOrder.id.slice(0, 8)}</h1>
          <p className="text-gray-500">Data: {new Date(finishedOrder.date).toLocaleDateString()}</p>
          <p className="text-gray-500 font-bold uppercase mt-2">{finishedOrder.status === 'pending' ? 'Em Aberto' : finishedOrder.status}</p>
          <p className="text-sm text-gray-500 mt-1">Tipo: {finishedOrder.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}</p>
        </div>

        <div className="mb-8">
          <h3 className="text-gray-600 font-bold uppercase text-xs mb-2">Cliente</h3>
          <p className="font-bold text-lg">{finishedOrder.customerName}</p>
          <p>{finishedOrder.customerAddress.street}, {finishedOrder.customerAddress.number}</p>
          <p>{finishedOrder.customerAddress.city} - {finishedOrder.customerAddress.state}, {finishedOrder.customerAddress.zip}</p>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left">
              <th className="py-2">Produto</th>
              <th className="py-2 text-right">Qtd</th>
              <th className="py-2 text-right">Preço Unit.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {finishedOrder.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-2">{item.productName}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                <td className="py-2 text-right">R$ {item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-12 print:break-inside-avoid">
          <div className="w-64">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span>R$ {finishedOrder.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-red-500">
              <span>Desconto:</span>
              <span>- R$ {finishedOrder.discountValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-xl">
              <span>Total:</span>
              <span>R$ {finishedOrder.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-4 print:break-inside-avoid">
           <p className="text-sm font-bold mb-2">Assinatura do Cliente:</p>
           {finishedOrder.signature ? (
             <img src={finishedOrder.signature} alt="Assinatura" className="h-20 border border-gray-300 rounded bg-gray-50" />
           ) : (
             <div className="h-20 border border-gray-300 border-dashed rounded flex items-center justify-center text-gray-400">
               Não assinado
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{editingOrder ? 'Editando Pedido' : 'Novo Pedido'}</h3>
            {editingOrder && <Button variant="danger" onClick={onCancelEdit}>Cancelar Edição</Button>}
        </div>

        <Card>
          <h3 className="font-medium mb-4 text-blue-600">1. Selecionar Cliente</h3>
          <Select 
            label="Cliente" 
            value={selectedClient?.id || ''} 
            onChange={(e: any) => setSelectedClient(customers.find((c: Customer) => c.id === e.target.value) || null)}
          >
            <option value="">Selecione...</option>
            {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {selectedClient && (
            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <strong>Endereço:</strong> {selectedClient.address.street}, {selectedClient.address.number} - {selectedClient.address.city}/{selectedClient.address.state}
            </div>
          )}
        </Card>

        <Card>
           <h3 className="font-medium mb-4 text-blue-600">2. Configuração do Pedido</h3>
           <Select label="Tipo de Pedido" value={orderType} onChange={(e: any) => setOrderType(e.target.value)}>
             <option value="RETAIL">Varejo</option>
             <option value="WHOLESALE">Atacado</option>
           </Select>
        </Card>

        <Card>
          <h3 className="font-medium mb-4 text-blue-600">3. Adicionar Produtos</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
               <Select id="prodSelect" label="Produto">
                 <option value="">Selecione...</option>
                 {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name} (R$ {p.price.toFixed(2)}) - Estoque: {p.stock}</option>)}
               </Select>
            </div>
            <div className="w-24">
              <Input id="prodQty" label="Qtd" type="number" defaultValue="1" />
            </div>
            <div className="mb-4">
              <Button onClick={() => {
                const sel = document.getElementById('prodSelect') as HTMLSelectElement;
                const qty = document.getElementById('prodQty') as HTMLInputElement;
                addToCart(sel.value, parseInt(qty.value));
              }}>Adicionar</Button>
            </div>
          </div>
        </Card>

        <Card>
           <h3 className="font-medium mb-4">Carrinho</h3>
           {cart.length === 0 ? <p className="text-gray-400">Carrinho vazio.</p> : (
             <table className="w-full text-sm">
               <thead><tr className="text-left bg-gray-50"><th className="p-2">Item</th><th className="p-2">Qtd</th><th className="p-2">Subtotal</th><th className="p-2"></th></tr></thead>
               <tbody>
                 {cart.map((item, idx) => (
                   <tr key={idx} className="border-t">
                     <td className="p-2">{item.product.name}</td>
                     <td className="p-2">{item.qty}</td>
                     <td className="p-2">R$ {(item.product.price * item.qty).toFixed(2)}</td>
                     <td className="p-2"><button onClick={() => removeFromCart(item.product.id)} className="text-red-500"><Trash2 size={14}/></button></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <h3 className="font-bold text-xl mb-6">Resumo e Assinatura</h3>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Desconto</label>
              <div className="flex gap-2">
                <Select value={discountType} onChange={(e: any) => setDiscountType(e.target.value)}>
                  <option value="value">R$</option>
                  <option value="percent">%</option>
                </Select>
                <Input type="number" value={discountVal} onChange={(e: any) => setDiscountVal(parseFloat(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 mb-6">
            <div className="flex justify-between"><span>Subtotal:</span> <span>R$ {calculateTotal().subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-red-500"><span>Desconto:</span> <span>- R$ {calculateTotal().dVal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t"><span>Total:</span> <span>R$ {calculateTotal().total.toFixed(2)}</span></div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Assinatura do Cliente</label>
            <SignaturePad onSave={setSignatureData} onClear={() => setSignatureData("")} />
            {signatureData && <p className="text-xs text-green-600 mt-1">Assinatura capturada.</p>}
          </div>

          <Button 
            className="w-full py-3 text-lg" 
            disabled={!selectedClient || cart.length === 0}
            onClick={handleFinish}
          >
            {editingOrder ? 'Salvar Alterações' : 'Gerar Pedido'}
          </Button>
        </Card>
      </div>
    </div>
  );
};

const ReportsView = ({ orders, customers, products, user }: any) => {
  const [reportType, setReportType] = useState<'NONE' | 'SALES' | 'PRODUCTS' | 'STOCK'>('NONE');
  const [aiReport, setAiReport] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  const completedOrders = orders.filter((o: Order) => o.status !== 'canceled');

  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    const text = await generateBusinessReport(completedOrders, products, customers);
    setAiReport(text);
    setLoadingAi(false);
  };

  const monthlyData = useMemo(() => {
    const months: any = {};
    completedOrders.forEach((o: Order) => {
      const key = o.date.slice(0, 7);
      months[key] = (months[key] || 0) + o.total;
    });
    return Object.keys(months).map(key => ({ name: key, total: months[key] }));
  }, [completedOrders]);

  const topProducts = useMemo(() => {
    const counts: any = {};
    completedOrders.forEach((o: Order) => {
      o.items.forEach(item => {
        counts[item.productName] = (counts[item.productName] || 0) + item.quantity;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);
  }, [completedOrders]);

  const stockData = useMemo(() => {
    return products.map((p: Product) => ({ name: p.name, stock: p.stock }));
  }, [products]);

  if (reportType === 'NONE') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {user.role !== 'STOCK_MANAGER' && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setReportType('SALES')}>
            <div className="flex items-center gap-3 mb-2 text-blue-600">
              <FileBarChart size={32} />
              <h3 className="text-xl font-bold">Relatório de Vendas</h3>
            </div>
            <p className="text-gray-500">Análise mensal e anual de faturamento.</p>
          </Card>
        )}

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setReportType('PRODUCTS')}>
          <div className="flex items-center gap-3 mb-2 text-green-600">
            <Package size={32} />
            <h3 className="text-xl font-bold">Top Produtos</h3>
          </div>
          <p className="text-gray-500">Ranking dos 10 produtos mais vendidos.</p>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setReportType('STOCK')}>
          <div className="flex items-center gap-3 mb-2 text-orange-600">
            <ClipboardList size={32} />
            <h3 className="text-xl font-bold">Estoque Geral</h3>
          </div>
          <p className="text-gray-500">Visão geral e níveis de estoque.</p>
        </Card>

        {user.role !== 'STOCK_MANAGER' && (
          <Card className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-purple-50 to-white border-purple-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-purple-800 mb-2 flex items-center gap-2">
                   <span className="text-2xl">✨</span> Análise IA
                </h3>
                <p className="text-gray-600 mb-4">Gere insights automáticos sobre seu negócio usando Inteligência Artificial.</p>
                <Button onClick={handleGenerateInsight} disabled={loadingAi} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {loadingAi ? 'Gerando Análise...' : 'Gerar Relatório Inteligente'}
                </Button>
              </div>
              {aiReport && (
                <div className="mt-4 lg:mt-0 lg:w-2/3 bg-white p-4 rounded shadow-sm border text-sm whitespace-pre-line">
                  {aiReport}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => setReportType('NONE')}>&larr; Voltar aos Relatórios</Button>
      
      {reportType === 'SALES' && (
        <Card>
          <h3 className="font-bold text-xl mb-4">Vendas Mensais</h3>
          <SalesChart data={monthlyData} />
        </Card>
      )}

      {reportType === 'PRODUCTS' && (
        <Card>
          <h3 className="font-bold text-xl mb-4">Top 10 Produtos Mais Vendidos</h3>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr><th className="text-left p-3">Rank</th><th className="text-left p-3">Produto</th><th className="text-right p-3">Qtd Vendida</th></tr>
            </thead>
            <tbody>
              {topProducts.map((p: any, i: number) => (
                <tr key={i} className="border-b">
                   <td className="p-3 font-bold text-gray-500">#{i+1}</td>
                   <td className="p-3">{p.name}</td>
                   <td className="p-3 text-right font-bold">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {reportType === 'STOCK' && (
        <Card>
          <h3 className="font-bold text-xl mb-4">Níveis de Estoque</h3>
          <ProductStockChart data={stockData} />
        </Card>
      )}
    </div>
  );
};

export default App;
