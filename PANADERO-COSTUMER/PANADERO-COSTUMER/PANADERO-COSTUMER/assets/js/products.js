(function(){
  const fallback = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='#f5ead7'/><text x='50%' y='48%' text-anchor='middle' font-family='Arial' font-size='54' font-weight='700' fill='#523622'>PANADERO</text><text x='50%' y='58%' text-anchor='middle' font-family='Arial' font-size='24' fill='#75604e'>Bakery Product</text></svg>`);
  const categories = [
    {id:'bread',name:'Breads'}, {id:'cake',name:'Cakes'}, {id:'doughnut',name:'Doughnuts'}, {id:'pie',name:'Pies'}
  ];
  const products = [
    {id:'baguette',slug:'baguette',name:'Baguette',category:'bread',price:65,image:'assets/images/baguette.jpg',description:'',stock:null,available:true},
    {id:'croissant',slug:'croissant',name:'Croissant',category:'bread',price:55,image:'assets/images/croissant.jpg',description:'',stock:null,available:true},
    {id:'pandesal',slug:'pandesal',name:'Pan de Sal',category:'bread',price:5,image:'assets/images/pandesal.jpg',description:'',stock:null,available:true},
    {id:'cinnamon-roll',slug:'cinnamon-roll',name:'Cinnamon Roll',category:'bread',price:45,image:'assets/images/cinnamon-roll.jpg',description:'',stock:null,available:true},
    {id:'chocolate-cake',slug:'chocolate-cake',name:'Chocolate Cake',category:'cake',price:450,image:'assets/images/chocolate-cake.jpg',description:'',stock:null,available:true},
    {id:'lemon-lime-cheesecake',slug:'lemon-lime-cheesecake',name:'Lemon & Lime Cheesecake',category:'cake',price:650,image:'assets/images/lemon-lime-cheesecake.jpg',description:'',stock:null,available:true},
    {id:'chiffon-cake',slug:'chiffon-cake',name:'Chiffon Cake',category:'cake',price:350,image:'assets/images/chiffon-cake.jpg',description:'',stock:null,available:true},
    {id:'bavarian-filled-doughnut',slug:'bavarian-filled-doughnut',name:'Bavarian-Filled Doughnut',category:'doughnut',price:35,image:'assets/images/bavarian-filled-doughnut.jpg',description:'',stock:null,available:true},
    {id:'beignet',slug:'beignet',name:'Beignet',category:'doughnut',price:30,image:'assets/images/beignet.jpg',description:'',stock:null,available:true},
    {id:'long-john',slug:'long-john',name:'Long John',category:'doughnut',price:35,image:'assets/images/long-john.jpg',description:'',stock:null,available:true},
    {id:'cruller',slug:'cruller',name:'Cruller',category:'doughnut',price:35,image:'assets/images/cruller.jpg',description:'',stock:null,available:true},
    {id:'apple-pie',slug:'apple-pie',name:'Apple Pie',category:'pie',price:300,image:'assets/images/apple-pie.jpg',description:'',stock:null,available:true},
    {id:'blueberry-pie',slug:'blueberry-pie',name:'Blueberry Pie',category:'pie',price:350,image:'assets/images/blueberry-pie.jpg',description:'',stock:null,available:true},
    {id:'egg-pie',slug:'egg-pie',name:'Egg Pie',category:'pie',price:250,image:'assets/images/egg-pie.jpg',description:'',stock:null,available:true},
    {id:'lemon-meringue-pie',slug:'lemon-meringue-pie',name:'Lemon Meringue Pie',category:'pie',price:350,image:'assets/images/lemon-meringue-pie.jpg',description:'',stock:null,available:true}
  ];
  window.PANADERO_DATA={products,categories,fallbackImage:fallback};
})();
