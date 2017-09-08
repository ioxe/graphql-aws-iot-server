export const createIotDataMock = (parentObj) => {
    return  {
        messages: [],
        publish: (params) => {
            const self = parentObj.iotData;
            return {
                promise: () => {
                    self.messages.push(params);
                    return Promise.resolve(params);
                }
            }
        }
    }
}