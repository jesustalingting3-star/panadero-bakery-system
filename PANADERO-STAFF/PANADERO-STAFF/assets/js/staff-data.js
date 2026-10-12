(function(){const API=window.PANADERO_API||'/api';let categories=[],items=[],batches=[];const clone=v=>JSON.parse(JSON.stringify(v));async function load(){try{const d=await req('/inventory');if(d.ok){categories=d.categories||[];items=(d.products||[]).map(item=>{
    const key=String(item.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
    const imageByName={'applepie':'apple-pie','baguette':'baguette','bavarianfilleddoughnut':'bavarian-filled-doughnut','beignet':'beignet','blueberrypie':'blueberry-pie','chiffoncake':'chiffon-cake','chocolatecake':'chocolate-cake','cinnamonroll':'cinnamon-roll','croissant':'croissant','cruller':'cruller','eggpie':'egg-pie','lemonlimecheesecake':'lemon-lime-cheesecake','lemonmeringuepie':'lemon-meringue-pie','longjohn':'long-john','pandesal':'pandesal','pandesal':'pandesal','pan de sal':'pandesal','lemonandlimecheesecake':'lemon-lime-cheesecake','bavarianfilleddoughnut':'bavarian-filled-doughnut'};
    const filename=imageByName[key];
    return {...item,category:item.categoryId||item.category,
      image: item.image || (filename ? '/customer/assets/images/'+filename+'.jpg' : '/staff/assets/images/logo.svg')};
  });batches=d.batches||[];window.dispatchEvent(new CustomEvent('panadero-inventory-changed'));window.dispatchEvent(new CustomEvent('panadero-orders-changed'));}else{window.dispatchEvent(new CustomEvent('panadero-inventory-error',{detail:d.message||'Unable to load inventory.'}));}}catch(_){window.dispatchEvent(new CustomEvent('panadero-inventory-error',{detail:'Unable to connect to the inventory API.'}));}return true}function req(p,o={}){const token=localStorage.getItem('panadero-api-token');return fetch(API+p,{...o,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}}).then(r=>r.json())}window.ProductService={getCategories:()=>clone(categories),getCategoryName:id=>(categories.find(c=>String(c.id)===String(id))||{name:id||''}).name,formatPrice:v=>v==null||v===''?'—':'₱'+Number(v).toFixed(2)};window.InventoryService={isConnected:()=>true,getItems:()=>clone(items),getBatches:()=>clone(batches),
  async updateStock(id,stock){
    const n=Number(stock);
    if(!Number.isSafeInteger(n)||n<0||n>1000000)return{ok:false,message:'Enter a whole stock quantity from 0 to 1,000,000.'};
    try{
      const result=await req('/inventory/products/'+encodeURIComponent(id)+'/stock',{method:'PATCH',body:JSON.stringify({stock:n})});
      if(result.ok)await load();
      return result;
    }catch(_){return{ok:false,message:'Unable to save stock. Check the server connection.'}}
  },
  async addBatch(v){
    const n=Number(v.quantity);
    if(!Number.isSafeInteger(n)||n<1||n>1000000)return{ok:false,message:'Enter a valid quantity.'};
    try{
      const result=await req('/inventory/batches',{method:'POST',body:JSON.stringify(v)});
      if(result.ok)await load();
      return result;
    }catch(_){return{ok:false,message:'Unable to save batch. Check the server connection.'}}
  },
  getSummary(){return{totalStock:items.reduce((sum,item)=>sum+(Number(item.stock)||0),0),
    outOfStock:items.filter(item=>item.stock===0).length,notSet:items.filter(item=>!Number.isInteger(item.stock)).length}}};
const get=()=>req('/staff/requests').then(d=>d.ok?d:({orders:[],reservations:[]}));window.OrderService={isConnected:()=>true,async getAllOrders(){return(await get()).orders||[]},async updateStatus(id,status){const r=await req('/orders/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})});window.dispatchEvent(new CustomEvent('panadero-orders-changed'));return r}};window.ReservationService={isConnected:()=>true,async getAllReservations(){const r=await req('/staff/requests');return r.ok?r.reservations||[]:[]},async updateStatus(id,status){const r=await req('/reservations/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})});window.dispatchEvent(new CustomEvent('panadero-reservations-changed'));return r}};window.PANADERO_DATA={products:[],categories:[],fallbackImage:''};window.PANADERO_INVENTORY_READY=load();})();
