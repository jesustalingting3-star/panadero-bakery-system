(function(){
  const fallback = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='#f5ead7'/><text x='50%' y='48%' text-anchor='middle' font-family='Arial' font-size='54' font-weight='700' fill='#523622'>PANADERO</text><text x='50%' y='58%' text-anchor='middle' font-family='Arial' font-size='24' fill='#75604e'>Bakery Product</text></svg>`);
  const categories = [
    {id:'bread',name:'Breads'}, {id:'cake',name:'Cakes'}, {id:'doughnut',name:'Doughnuts'}, {id:'pie',name:'Pies'}
  ];
  const products = [
    {id:'baguette',slug:'baguette',name:'Baguette',category:'bread',price:65,image:'https://tinyurl.com/2yzrkpwr',description:'',stock:null,available:true},
    {id:'croissant',slug:'croissant',name:'Croissant',category:'bread',price:55,image:'https://tinyurl.com/ymnznb49',description:'',stock:null,available:true},
    {id:'pandesal',slug:'pandesal',name:'Pan de Sal',category:'bread',price:5,image:'https://tinyurl.com/mwnwx59d',description:'',stock:null,available:true},
    {id:'cinnamon-roll',slug:'cinnamon-roll',name:'Cinnamon Roll',category:'bread',price:45,image:'https://tinyurl.com/bkybk3zr',description:'',stock:null,available:true},
    {id:'chocolate-cake',slug:'chocolate-cake',name:'Chocolate Cake',category:'cake',price:450,image:'https://tinyurl.com/yt9au5kd',description:'',stock:null,available:true},
    {id:'lemon-lime-cheesecake',slug:'lemon-lime-cheesecake',name:'Lemon & Lime Cheesecake',category:'cake',price:650,image:'https://tinyurl.com/599ku65x',description:'',stock:null,available:true},
    {id:'chiffon-cake',slug:'chiffon-cake',name:'Chiffon Cake',category:'cake',price:350,image:'https://tinyurl.com/2xs9nacs',description:'',stock:null,available:true},
    {id:'bavarian-filled-doughnut',slug:'bavarian-filled-doughnut',name:'Bavarian-Filled Doughnut',category:'doughnut',price:35,image:'https://tinyurl.com/3kxwf6ma',description:'',stock:null,available:true},
    {id:'beignet',slug:'beignet',name:'Beignet',category:'doughnut',price:30,image:'https://tinyurl.com/5n6z77ff',description:'',stock:null,available:true},
    {id:'long-john',slug:'long-john',name:'Long John',category:'doughnut',price:35,image:'https://tinyurl.com/33ajp82w',description:'',stock:null,available:true},
    {id:'cruller',slug:'cruller',name:'Cruller',category:'doughnut',price:35,image:'https://tinyurl.com/yuwe7v5n',description:'',stock:null,available:true},
    {id:'apple-pie',slug:'apple-pie',name:'Apple Pie',category:'pie',price:300,image:'https://tinyurl.com/3yafkent',description:'',stock:null,available:true},
    {id:'blueberry-pie',slug:'blueberry-pie',name:'Blueberry Pie',category:'pie',price:350,image:'https://tinyurl.com/4f6akf88',description:'',stock:null,available:true},
    {id:'egg-pie',slug:'egg-pie',name:'Egg Pie',category:'pie',price:250,image:'https://tinyurl.com/2fvkz7ev',description:'',stock:null,available:true},
    {id:'lemon-meringue-pie',slug:'lemon-meringue-pie',name:'Lemon Meringue Pie',category:'pie',price:350,image:'https://tinyurl.com/57h9j5xj',description:'',stock:null,available:true}
  ];
  window.PANADERO_DATA={products,categories,fallbackImage:fallback};
})();