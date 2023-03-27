const app=require("express")();
const PORT = process.env.port || 3000;
app.get("",(req,res)=>{
    res.send("This is SForceEditor API");
})

app.listen(PORT,()=>{
    console.log(`App is running on port ${PORT}`);
})