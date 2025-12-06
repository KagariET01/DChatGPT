
(async()=>{
	let stop=()=>{};
	
	let fn=async(r)=>{
		while(1){
			await new Promise(res=>setTimeout(res,1000));
			console.log("running...");
		}
	};
	fn=fn();

	await new Promise(res=>setTimeout(res,5000));
	
})();



