const API_URLS = [
  "https://script.google.com/macros/s/AKfycbznSI21r4TTdKh8LhIIgqnhjNC8YkVcyEkxLDBpn-UEQiLkmkdXu5U5cxYH3iyjmm2Q/exec",
  "https://script.google.com/macros/s/AKfycbyPFdBnaCvsArf3FGBWLo3ZFg70f17yqgtnScQjBNjPbuCaHonJ7E-orPhn2NcFYD4lNw/exec",
  "https://script.google.com/macros/s/AKfycbzOVtdHsJBkUBGNZaDd3YAFJ3Qc2nvIl5m-EfcUUOjIMyeOX0KZsot8mxAJALOgkQkffg/exec",
  "https://script.google.com/macros/s/AKfycbxfRTCgjCmjQ8PRMhi_DEpRdjBbWifIHsvlOAKRWZqOIhX-xowMG0VJyEvG1yzCvrheyA/exec",
  "https://script.google.com/macros/s/AKfycbwWN7HtCdHA7nmyYw_CU6th4IOQDSqJtC0BV7bMjLbrh64yuXXeLUz5_5Q87as1lTUF/exec",
  "https://script.google.com/macros/s/AKfycbxOPej3whhrRtpuTJ3XhTXrScRDm105AfLZqWQ_-0iQRe1oj5W9jqBkei17vsknPv9AIQ/exec",
  "https://script.google.com/macros/s/AKfycbw6N3kCyGyAoiG4ShD_9ombBIadWnA6T4hrs8laghc_54GtF6Eq7DotiIBeJNYiJGcizQ/exec",
  "https://script.google.com/macros/s/AKfycbwlyB-QlxcFSnV3R9_XNzMFZwop0DoYz3eWyQX5Ii2Ts1IVXZZDAfpNRUbDwlkHlNfLKA/exec",
  "https://script.google.com/macros/s/AKfycbzqpav7y2x3q756wRSOhBzaXf-2hKaLTvxoFN8kFegrIvamH03ZXphEw2PK30L7AstC/exec",
  "https://script.google.com/macros/s/AKfycbyXCS6JsBglbqlW0eIOWpVscTdNA8QUISRaGMJUAiMlYfp4Ju-Avkw1ai3A6P_ek-FK/exec",
  "https://script.google.com/macros/s/AKfycby5bmMQBShFOv_inDOo9jUjwxjdF6PeIh8spKAncj0-h5idAHYodOy-jj9YZStcYa-L/exec",
  "https://script.google.com/macros/s/AKfycbw5Cci8LSWChLvFf17uNW5cZDqESr0XFuI3QNZDRsdn5su1K4VzTfB0oq7SKNXzimT1Aw/exec",
  "https://script.google.com/macros/s/AKfycbwJFbZ4CHnuvy8rppZLfbWWuOHMqaM89nlsv7gThIzW_x0Bn2cj7IJU6XHC5CHG2B-yqQ/exec",
  "https://script.google.com/macros/s/AKfycbzYHLmomiijxiaNGcdLY_ddDZIi3QTK408EQDEpsa82FtIt4VTGRuC8ovZxM7kUSrC2/exec",
  "https://script.google.com/macros/s/AKfycbygQyKvfPnMvY8sdOkKow6NzO91dBhQFy0Vex3qVq1tWnqKodNbFVKQhALWWBLXcRTF/exec",
  "https://script.google.com/macros/s/AKfycbyh11OPhy_xaZOPVz3uKVFy8qdN05hVRrpKrNXuIeogsTLwiQQYBUhKZMniStVhg7QF-A/exec",
  "https://script.google.com/macros/s/AKfycbwZjWOfb6U3-WJEPY7bH72BX1Oq5ZYIsX0X_oSCM7XsZTL_XR52jr6pHCKsfXlmEqIO/exec",
  "https://script.google.com/macros/s/AKfycbw5KoedRHydSOSer3QPHAEBtOJEZWTrqZ_536rjYA6JClQgxHO6ZaqsW0gE2Nm2XQ48yw/exec",
  "https://script.google.com/macros/s/AKfycbywNoIJAH0ZHZ1U_IxVPWWvMTNwrUpXqEi-0j2V-RGNpx9EHDBKJ1XJw9RRuj0_uNrz/exec",
  "https://script.google.com/macros/s/AKfycbyjbFpmnhvs0BSorjNuIoZkIOsiH7OsovlYkl3DBI9SA3_19jOBqjr999WA_12HYxhT0A/exec",
  "https://script.google.com/macros/s/AKfycbzXpCGpUPLSP4jvrc1IXv42ZQlCv5jabJtDL6QbfqPHRS6j3yAwjAkQJaLVDGLmIOTemg/exec",
  "https://script.google.com/macros/s/AKfycbwY_1cpVuhoOYLO7cOiPsnrPWwVJaPTJqVIIvqyZ7p3nhcGOgjn2eEZBG3b_7rEDm4h9Q/exec",
  "https://script.google.com/macros/s/AKfycbw3sV6Qgd37JbsVSWXfDf4y91uiyOpo2NYCAAf-UogGifPaS87AxAo5ABImwI8EFp2TmQ/exec",
  "https://script.google.com/macros/s/AKfycbzc79FH_lPlAIW6YW5iW7neCmB-4mDpzTvzCNfoNZfyfEZZuK6ynuuYfvGj1Y76dR0c/exec",
  "https://script.google.com/macros/s/AKfycbxCcLzGDK-y6oP6hjnlMT7A2T5JPAR9A262P0sLF0qGVnEtGGbC_wQuBFObXDfwYpgn5g/exec",
  "https://script.google.com/macros/s/AKfycbz5CNCVcLSU1NP9hNfd4PXK-8wxx1CqRiydQHSqoqJLnH5hO5khzStVixdalux4f-pG/exec",
  "https://script.google.com/macros/s/AKfycbwtnEfWr6Rd_R2vm3-_sBYQazD4kDggYXeIWB0yadTKekt7AQP-t-_HHcZTQP_2aGHR/exec",
  "https://script.google.com/macros/s/AKfycbz1BaVdoqmZ63Eo7ml--6d7JROJIv36YX-aNy83EbvE-ttZHo5YAiyc2G7dUBOUb03C/exec",
  "https://script.google.com/macros/s/AKfycbzishJLLG6oO6gaz87xlim1VhVcoYs5aSN1VIN1sT0qQexiya7frJ5d-poVmdNHpsWtFA/exec",
  "https://script.google.com/macros/s/AKfycbxBgfeCw15O7mTs02rk_7itTVqEw6LYmwIiLM_f3fEE_y4UVoZ3L9_yyku7NorqSUdP/exec",
  "https://script.google.com/macros/s/AKfycbxgX4zORG-FhJo4BxVwBtZsQP8i8Iode81Y4VtdPtzoI5JJ0yM1JXAiJ3skZUHB8A8M/exec",
  "https://script.google.com/macros/s/AKfycbyGoeb6FENHGbUZH7tZ_-ZyS13MJ3DLQoLSBl2Gt6vJYIZqL-QTTwd2gJKfDo-QFrRW/exec",
  "https://script.google.com/macros/s/AKfycbx8DE5O814hhpobytdy8tnVoXWcTGMCynkA7hO9jDZNcWLehGpn4su1OUu8wZCZEd5_FA/exec",
  "https://script.google.com/macros/s/AKfycbyZbXSvtk1p67JiXuC7YZlM9VkvMKPcaVTubhFU0Hic5KgmTWOGufOtxleLl6a9lZQ/exec",
  "https://script.google.com/macros/s/AKfycbwz-iwbMIE-jVWZ35Er0dNkgOlYcsBqLYImEV4iGRwHF-yntsGTO82atQSxHtwf50u0/exec",
  "https://script.google.com/macros/s/AKfycbyu4gQvX98JMZTiIwrgXpIb_E9bvfpFBKHPGqjoOQ0HpCeH6IoIUK50UmH2v0cJhJrt/exec",
  "https://script.google.com/macros/s/AKfycby6JzzPf91tIh76M2r4kLemeQy3z68JgXJ8OCpKkjb61qCrq1QbW590t5Qnvxu4jOvj3Q/exec"
];

// ランダムに1つ返す関数
export function apiurl() {
  const index = Math.floor(Math.random() * API_URLS.length);
  return API_URLS[index];
}

export { API_URLS };

export const STORAGE_KEY = "custom_api_endpoints_v1";
export const MODE_KEY = "api_mode_v1";
