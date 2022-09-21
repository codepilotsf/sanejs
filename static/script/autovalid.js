function autovalid(options = {}) {
  const scope = options.scope || document
  const fields = scope.querySelectorAll('input, select, textarea')
  const wrappingForm = fields.length ? fields[0].closest('form') : {}

  // Add event listeners for each field
  fields.forEach(field => {
    field.addEventListener('invalid', e => {
      if (options.preventDefault) e.preventDefault()
      markInvalid(field)
    })

    field.addEventListener('input', () => {
      if (field.validity.valid) {
        markValid(field)
      }
    })

    field.addEventListener('blur', () => {
      field.checkValidity() ? markValid(field) : markInvalid(field)
    })
  })

  function markInvalid(field) {
    field.classList.add('invalid')
    const wrappingLabel = field.closest('label')
    if (wrappingLabel) wrappingLabel.classList.add('invalid')
    if (wrappingForm) wrappingForm.classList.add('invalid')
  }

  function markValid(field) {
    field.classList.remove('invalid')
    const wrappingLabel = field.closest('label')
    if (wrappingLabel) wrappingLabel.classList.remove('invalid')
    if (scope.querySelectorAll(':invalid').length < 1) wrappingForm.classList.remove('invalid')
  }
}